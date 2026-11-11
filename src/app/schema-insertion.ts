import type { Element, Point, SchemaField, SchemaTableElement, ShapeElement } from "../model";
import { MAX_SCHEMA_SOURCE_CHARACTERS, parseSchema } from "../schema";
import { schemaRelationshipConnectors } from "../features/diagrams/schema-visualizer";
import { schemaTableMinimumWidth, schemaTableMinimumHeight } from "../features/diagrams/schema-table-layout";
import { autoRouteConnectorSet } from "../features/diagrams/connector-routing";
import { elementBounds, unionBounds } from "../features/canvas/bounds";
import { isConnector, resolveBindings } from "../operations";
import { cloneElements } from "./canvas-helpers";

export type SchemaInsertionContext = {
  activePath: () => string | undefined;
  elements: () => Element[];
  boardLocked: () => boolean;
  canvas: () => HTMLCanvasElement | undefined;
  canvasState: () => { panX: number; panY: number; zoom: number };
  schemaImporting: () => boolean;
  setSchemaImporting: (value: boolean) => void;
  schemaInput: () => string;
  schemaEditingDiagram: () => string | undefined;
  selectedElements: () => Element[];
  selectedRootElement: () => Element | undefined;
  defaultFontSize: () => number;
  schemaPanelDiagramId: () => string | undefined;
  isElementHidden: (item: Element) => boolean;
  isElementLocked: (item: Element) => boolean;
  pushUndo: (snapshot: Element[]) => void;
  setElements: (updater: Element[] | ((items: Element[]) => Element[])) => void;
  setSelectedIndices: (indices: number[]) => void;
  setTool: (tool: string) => void;
  setTextMode: (mode: string) => void;
  setSchemaDialog: (open: boolean) => void;
  setSchemaInput: (value: string) => void;
  setSchemaError: (value: string) => void;
  setSchemaEditingDiagram: (value: string | undefined) => void;
  setDirty: (dirty: boolean) => void;
};

export function createSchemaInsertion(ctx: SchemaInsertionContext) {
  let schemaLiveUndoDiagramId: string | undefined;
  let schemaLiveUndoBefore: Element[] | undefined;
  let schemaLiveApplying = false;
  let activeSchemaPanelDiagramId: string | undefined;
  let lastAppliedSchemaSource: string | undefined;

  async function insertSchemaVisual(liveUpdate = false, liveSource?: string, liveDiagramId?: string) {
    const path = ctx.activePath(); const beforeElements = ctx.elements();
    const canvas = ctx.canvas();
    if (!path || ctx.boardLocked() || !canvas || (!liveUpdate && ctx.schemaImporting()) || (liveUpdate && schemaLiveApplying)) return;
    const editingId = liveUpdate ? liveDiagramId : ctx.schemaEditingDiagram();
    if (liveUpdate && !editingId) return;
    if (liveUpdate) schemaLiveApplying = true;
    else ctx.setSchemaImporting(true);
    try {
      const source = (liveUpdate ? liveSource : ctx.schemaInput())?.trim() ?? "";
      const parsedTables = parseSchema(source); const tableNames = new Set<string>();
      for (const table of parsedTables) {
        const tableName = `${table.objectKind ?? "table"}:${table.name.toLowerCase()}`; if (tableNames.has(tableName)) throw new Error(`${table.objectKind ?? "table"} "${table.name}" appears more than once.`); tableNames.add(tableName);
        const columnNames = new Set<string>(); for (const column of table.columns) { const columnName = column.name.toLowerCase(); if (columnNames.has(columnName)) throw new Error(`Column "${column.name}" appears more than once in table "${table.name}".`); columnNames.add(columnName); }
      }

      const width = 170; const gapX = 64; const gapY = 42;
      const columnsPerRow = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(parsedTables.length))));
      const existing = editingId ? beforeElements.filter((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === editingId) : [];
      if (liveUpdate && !existing.length) throw new Error("Select a schema card before editing its source.");
      if (liveUpdate && existing.every(table => table.schemaSource === source)) return;
      const selectedTableIds = liveUpdate ? ctx.selectedElements().filter((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === editingId).flatMap(item => item.id ? [item.id] : []) : [];
      const selectedPrimaryId = liveUpdate ? ctx.selectedRootElement()?.id : undefined;
      const objectKey = (table: (typeof parsedTables)[number] | SchemaTableElement) => `${table.objectKind ?? "table"}:${table.name.toLowerCase()}`;
      const oldByName = new Map(existing.map(table => [objectKey(table), table]));
      const cardFontSize = (table: (typeof parsedTables)[number]) => oldByName.get(objectKey(table))?.fontSize ?? ctx.defaultFontSize();
      const cardWidth = (table: (typeof parsedTables)[number]) => {
        const old = oldByName.get(objectKey(table));
        return old?.w ?? Math.max(width, schemaTableMinimumWidth(table.columns.map(column => ({ name: column.name, dataType: column.type })), cardFontSize(table), width, table.name));
      };
      const cardHeight = (table: (typeof parsedTables)[number]) => schemaTableMinimumHeight(table.columns.length, cardFontSize(table));
      const positions = new Map<string, Point>();
      if (!existing.length) {
        const columnWidths = Array.from({ length: columnsPerRow }, (_, col) => Math.max(...parsedTables.filter((_table, index) => index % columnsPerRow === col).map(cardWidth)));
        const rowHeights = Array.from({ length: Math.ceil(parsedTables.length / columnsPerRow) }, (_, row) => Math.max(...parsedTables.slice(row * columnsPerRow, (row + 1) * columnsPerRow).map(cardHeight)));
        const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0) + (columnsPerRow - 1) * gapX;
        const totalHeight = rowHeights.reduce((sum, item) => sum + item, 0) + (rowHeights.length - 1) * gapY;
        const rect = canvas.getBoundingClientRect(); const view = ctx.canvasState();
        const originX = (rect.width / 2 - view.panX) / view.zoom - totalWidth / 2;
        const originY = (rect.height / 2 - view.panY) / view.zoom - totalHeight / 2;
        parsedTables.forEach((table, index) => {
          const row = Math.floor(index / columnsPerRow); const col = index % columnsPerRow;
          positions.set(objectKey(table), { x: originX + columnWidths.slice(0, col).reduce((sum, current) => sum + current + gapX, 0), y: originY + rowHeights.slice(0, row).reduce((sum, current) => sum + current + gapY, 0) });
        });
      } else {
        const right = Math.max(...existing.map(table => table.x + table.w));
        let fallbackY = Math.min(...existing.map(table => table.y));
        const placedNewPositions = new Map<string, { x: number; y: number }>();
        for (const table of parsedTables) {
          const key = objectKey(table); const old = oldByName.get(key);
          if (old) { positions.set(key, { x: old.x, y: old.y }); continue; }
          let relatedTable: SchemaTableElement | undefined;
          for (const col of table.columns) {
            if (col.foreignTable) {
              const related = oldByName.get(`table:${col.foreignTable.toLowerCase()}`);
              if (related) { relatedTable = related; break; }
            }
          }
          if (!relatedTable) {
            for (const ex of existing) {
              for (const col of ex.columns) {
                if (col.foreignTable?.toLowerCase() === table.name.toLowerCase()) { relatedTable = ex; break; }
              }
              if (relatedTable) break;
            }
          }
          if (relatedTable) {
            const offsetX = relatedTable.w + gapX;
            let posX = relatedTable.x + offsetX;
            let posY = relatedTable.y;
            const tw = cardWidth(table); const th = cardHeight(table);
            const overlaps = (px: number, py: number) => {
              for (const ex of existing) {
                if (px < ex.x + ex.w + gapX / 2 && px + tw + gapX / 2 > ex.x && py < ex.y + ex.h + gapY / 2 && py + th + gapY / 2 > ex.y) return true;
              }
              for (const [, placed] of placedNewPositions) {
                if (px < placed.x + tw + gapX / 2 && px + tw + gapX / 2 > placed.x && py < placed.y + th + gapY / 2 && py + th + gapY / 2 > placed.y) return true;
              }
              return false;
            };
            if (overlaps(posX, posY)) {
              posY = relatedTable.y + relatedTable.h + gapY;
              if (overlaps(posX, posY)) { posX = right + gapX; posY = fallbackY; fallbackY += th + gapY; }
            }
            positions.set(key, { x: posX, y: posY });
            placedNewPositions.set(key, { x: posX, y: posY });
          } else {
            positions.set(key, { x: right + gapX, y: fallbackY });
            placedNewPositions.set(key, { x: right + gapX, y: fallbackY });
            fallbackY += cardHeight(table) + gapY;
          }
        }
      }

      const diagramId = editingId ?? crypto.randomUUID();
      const created: SchemaTableElement[] = parsedTables.map(table => {
        const old = oldByName.get(objectKey(table));
        const fieldsByName = new Map(old?.columns.map(field => [field.name.toLowerCase(), field]) ?? []);
        const fields: SchemaField[] = table.columns.map(column => ({ id: fieldsByName.get(column.name.toLowerCase())?.id ?? crypto.randomUUID(), name: column.name, dataType: column.type, primaryKey: column.primaryKey, foreignTable: column.foreignTable, foreignColumn: column.foreignColumn, nullable: column.nullable }));
        const fontSize = old?.fontSize ?? ctx.defaultFontSize(); const position = positions.get(objectKey(table))!;
        return { type: "schemaTable", id: old?.id ?? crypto.randomUUID(), schemaDiagramId: diagramId, schemaSource: source, name: table.name, objectKind: table.objectKind ?? "table", ...(table.viewQuery ? { viewQuery: table.viewQuery } : {}), ...(table.enumValues?.length ? { enumValues: table.enumValues } : {}), columns: fields, ...(table.indexes?.length ? { indexes: table.indexes } : {}), ...(table.constraints?.length ? { constraints: table.constraints } : {}), ...position, w: cardWidth(table), h: cardHeight(table), fontSize, rotation: old?.rotation ?? 0, opacity: old?.opacity ?? 1 };
      });

      const relations = schemaRelationshipConnectors(created.filter(table => (table.objectKind ?? "table") === "table"), diagramId);

      let imported: Element[] = [...relations, ...created];
      if (!liveUpdate && !existing.length && created.length > 1) {
        const { autoLayoutElements } = await import("../features/diagrams/auto-layout");
        imported = await autoLayoutElements(imported, [], "RIGHT", "erd", "layered", "page", 48, ctx.isElementHidden, ctx.isElementLocked);
        if (ctx.activePath() !== path || ctx.elements() !== beforeElements) return;
        const tableBounds = unionBounds(imported.filter((item): item is SchemaTableElement => item.type === "schemaTable").map(elementBounds));
        if (tableBounds) {
          const rect = canvas.getBoundingClientRect(); const view = ctx.canvasState();
          const centerX = (rect.width / 2 - view.panX) / view.zoom; const centerY = (rect.height / 2 - view.panY) / view.zoom;
          const dx = centerX - tableBounds.x - tableBounds.w / 2; const dy = centerY - tableBounds.y - tableBounds.h / 2;
          imported = imported.map(item => item.type === "schemaTable"
            ? { ...item, x: item.x + dx, y: item.y + dy }
            : isConnector(item) ? { ...item, x: (item as ShapeElement).x + dx, y: (item as ShapeElement).y + dy, routePoints: (item as ShapeElement).routePoints?.map(point => ({ x: point.x + dx, y: point.y + dy })), routeWaypoints: (item as ShapeElement).routeWaypoints?.map(point => ({ x: point.x + dx, y: point.y + dy })) } : item);
        }
      }
      const laidOutTables = imported.filter((item): item is SchemaTableElement => item.type === "schemaTable");
      const laidOutRelations = schemaRelationshipConnectors(laidOutTables.filter(table => (table.objectKind ?? "table") === "table"), diagramId);
      imported = autoRouteConnectorSet([...laidOutRelations, ...laidOutTables], ctx.isElementHidden, ctx.isElementLocked);
      if (ctx.activePath() !== path || ctx.elements() !== beforeElements) return;

      const existingIds = new Set(existing.flatMap(table => table.id ? [table.id] : []));
      const removedRelations = new Set(beforeElements.filter(item => isConnector(item) && (item as ShapeElement).schemaDiagramId === diagramId).flatMap(item => item.id ? [item.id] : []));
      const oldIds = new Set([...existingIds, ...removedRelations]);
      const kept = beforeElements.filter(item => !oldIds.has(item.id ?? ""));
      const updatedElements = resolveBindings([...kept, ...imported]);
      if (liveUpdate) {
        if (schemaLiveUndoDiagramId !== diagramId || !schemaLiveUndoBefore) {
          schemaLiveUndoDiagramId = diagramId;
          schemaLiveUndoBefore = cloneElements(beforeElements);
          ctx.pushUndo(schemaLiveUndoBefore);
        }
        if (activeSchemaPanelDiagramId === diagramId) lastAppliedSchemaSource = source;
        ctx.setElements(updatedElements);
        const selectedIndexes = selectedTableIds.map(id => updatedElements.findIndex(item => item.id === id)).filter(index => index >= 0);
        if (selectedIndexes.length) ctx.setSelectedIndices(selectedIndexes);
        else {
          const fallbackId = selectedPrimaryId && created.some(table => table.id === selectedPrimaryId) ? selectedPrimaryId : created[0]?.id;
          const fallbackIndex = fallbackId ? updatedElements.findIndex(item => item.id === fallbackId) : -1;
          ctx.setSelectedIndices(fallbackIndex >= 0 ? [fallbackIndex] : []);
        }
      } else {
        ctx.pushUndo(cloneElements(beforeElements)); ctx.setElements(updatedElements);
        const firstIndex = kept.length; ctx.setSelectedIndices(created.map((_item, index) => firstIndex + relations.length + index)); ctx.setTool("select"); ctx.setTextMode("text");
        ctx.setSchemaDialog(false); ctx.setSchemaInput(""); ctx.setSchemaError(""); ctx.setSchemaEditingDiagram(undefined);
      }
      ctx.setDirty(true);
    } catch (cause) {
      if (ctx.activePath() === path && liveUpdate && editingId && typeof liveSource === "string" && liveSource.length > MAX_SCHEMA_SOURCE_CHARACTERS && ctx.schemaPanelDiagramId() === editingId) {
        const existingSchema = beforeElements.filter((item): item is SchemaTableElement => item.type === "schemaTable" && item.schemaDiagramId === editingId);
        if (existingSchema.length) {
          if (schemaLiveUndoDiagramId !== editingId || !schemaLiveUndoBefore) {
            schemaLiveUndoDiagramId = editingId;
            schemaLiveUndoBefore = cloneElements(beforeElements);
            ctx.pushUndo(schemaLiveUndoBefore);
          }
          lastAppliedSchemaSource = liveSource;
          ctx.setElements(beforeElements.map(item => item.type === "schemaTable" && item.schemaDiagramId === editingId ? { ...item, schemaSource: liveSource } : item));
          ctx.setDirty(true);
          ctx.setSchemaError(`The full source text was saved. Diagram preview updates are limited to ${MAX_SCHEMA_SOURCE_CHARACTERS.toLocaleString()} characters.`);
          return;
        }
      }
      if (ctx.activePath() === path && (!liveUpdate || ctx.schemaPanelDiagramId() === editingId)) ctx.setSchemaError(cause instanceof Error ? cause.message : String(cause));
    }
    finally { if (liveUpdate) schemaLiveApplying = false; else ctx.setSchemaImporting(false); }
  }

  return {
    insertSchemaVisual,
    get schemaLiveApplying() { return schemaLiveApplying; },
    get activeSchemaPanelDiagramId() { return activeSchemaPanelDiagramId; },
    set activeSchemaPanelDiagramId(value: string | undefined) { activeSchemaPanelDiagramId = value; },
    get lastAppliedSchemaSource() { return lastAppliedSchemaSource; },
    set lastAppliedSchemaSource(value: string | undefined) { lastAppliedSchemaSource = value; },
    get schemaLiveUndoDiagramId() { return schemaLiveUndoDiagramId; },
    set schemaLiveUndoDiagramId(value: string | undefined) { schemaLiveUndoDiagramId = value; },
    get schemaLiveUndoBefore() { return schemaLiveUndoBefore; },
    set schemaLiveUndoBefore(value: Element[] | undefined) { schemaLiveUndoBefore = value; },
  };
}
