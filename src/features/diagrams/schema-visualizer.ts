import type { SchemaColumn, SchemaTable } from "../../schema";
import type { SchemaTableElement, ShapeElement } from "../../model";
import { anchorPoint } from "../../operations";

export type SchemaReference = {
  sourceTable: SchemaTable;
  sourceColumn: SchemaColumn;
  targetTable: SchemaTable;
  targetColumn: SchemaColumn;
};

/** Resolves foreign keys only when both ends name real fields in this import. */
export function schemaReferences(tables: SchemaTable[]): SchemaReference[] {
  const tablesByName = new Map(tables.map(table => [table.name.toLowerCase(), table]));
  const references: SchemaReference[] = [];
  const seen = new Set<string>();

  const add = (sourceTable: SchemaTable, sourceColumn: SchemaColumn, targetTable: SchemaTable, targetColumn: SchemaColumn) => {
    const key = [sourceTable.name, sourceColumn.name, targetTable.name, targetColumn.name].map(value => value.toLowerCase()).join("\u0000");
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ sourceTable, sourceColumn, targetTable, targetColumn });
  };

  for (const sourceTable of tables) {
    for (const constraint of sourceTable.constraints ?? []) {
      if (constraint.kind !== "foreign-key" || !constraint.referencedTable) continue;
      const targetTable = tablesByName.get(constraint.referencedTable.toLowerCase());
      if (!targetTable) continue;
      const primaryKeys = targetTable.columns.filter(column => column.primaryKey);
      for (const [index, sourceName] of (constraint.columns ?? []).entries()) {
        const sourceColumn = sourceTable.columns.find(column => column.name.toLowerCase() === sourceName.toLowerCase());
        const targetName = constraint.referencedColumns?.[index] ?? primaryKeys[index]?.name ?? (primaryKeys.length === 1 ? primaryKeys[0].name : undefined);
        const targetColumn = targetName && targetTable.columns.find(column => column.name.toLowerCase() === targetName.toLowerCase());
        if (sourceColumn && targetColumn) add(sourceTable, sourceColumn, targetTable, targetColumn);
      }
    }
  }

  for (const sourceTable of tables) for (const sourceColumn of sourceTable.columns) {
    if (!sourceColumn.foreignTable) continue;
    const targetTable = tablesByName.get(sourceColumn.foreignTable.toLowerCase());
    if (!targetTable) continue;
    const primaryKeys = targetTable.columns.filter(column => column.primaryKey);
    const targetName = sourceColumn.foreignColumn ?? (primaryKeys.length === 1 ? primaryKeys[0].name : undefined);
    const targetColumn = targetName && targetTable.columns.find(column => column.name.toLowerCase() === targetName.toLowerCase());
    if (targetColumn) add(sourceTable, sourceColumn, targetTable, targetColumn);
  }

  return references;
}

type Side = "left" | "right" | "top" | "bottom";
type TableBox = { cx: number; cy: number; x: number; y: number; w: number; h: number };

function tableCenter(table: SchemaTableElement): TableBox {
  return { cx: table.x + table.w / 2, cy: table.y + table.h / 2, x: table.x, y: table.y, w: table.w, h: table.h };
}

/**
 * Pick the best side pair for a connector between two tables.
 * Considers all 4 sides and picks the pair with shortest Manhattan distance
 * that doesn't require routing through either table.
 */
function bestSides(parent: TableBox, child: TableBox): { parentSide: Side; childSide: Side } {
  const gapRight = child.x - (parent.x + parent.w);
  const gapLeft = parent.x - (child.x + child.w);
  const gapBelow = child.y - (parent.y + parent.h);
  const gapAbove = parent.y - (child.y + child.h);

  const candidates: { parentSide: Side; childSide: Side; cost: number }[] = [];

  // Horizontal: parent-right → child-left
  if (gapRight > -20) candidates.push({ parentSide: "right", childSide: "left", cost: Math.abs(gapRight) + Math.abs(parent.cy - child.cy) * 0.3 });
  // Horizontal: parent-left → child-right
  if (gapLeft > -20) candidates.push({ parentSide: "left", childSide: "right", cost: Math.abs(gapLeft) + Math.abs(parent.cy - child.cy) * 0.3 });
  // Vertical: parent-bottom → child-top
  if (gapBelow > -20) candidates.push({ parentSide: "bottom", childSide: "top", cost: Math.abs(gapBelow) + Math.abs(parent.cx - child.cx) * 0.3 });
  // Vertical: parent-top → child-bottom
  if (gapAbove > -20) candidates.push({ parentSide: "top", childSide: "bottom", cost: Math.abs(gapAbove) + Math.abs(parent.cx - child.cx) * 0.3 });

  // Same-side for self-references or heavily overlapping
  if (!candidates.length) {
    candidates.push(
      { parentSide: "right", childSide: "right", cost: 1000 },
      { parentSide: "left", childSide: "left", cost: 1001 },
    );
  }

  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0];
}

function sideAnchorX(side: Side): number {
  return side === "right" ? 1 : side === "left" ? 0 : 0.5;
}

function sideAnchorY(side: Side): number {
  return side === "bottom" ? 1 : side === "top" ? 0 : 0.5;
}

/**
 * Distribute multiple connectors across a side so they don't overlap.
 * Returns a map from connector-key to the y (horizontal sides) or x (vertical sides) fraction.
 */
function distributePortsOnSide(
  portKeys: string[],
  side: Side,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const count = portKeys.length;

  if (side === "left" || side === "right") {
    const anchorX = side === "right" ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : 0.15 + (i / (count - 1)) * 0.7;
      result.set(portKeys[i], { x: anchorX, y: t });
    }
  } else {
    const anchorY = side === "bottom" ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : 0.15 + (i / (count - 1)) * 0.7;
      result.set(portKeys[i], { x: t, y: anchorY });
    }
  }

  return result;
}

/** Build one row-bound connector for every resolvable foreign-key column pair. */
export function schemaRelationshipConnectors(tables: SchemaTableElement[], schemaDiagramId: string): ShapeElement[] {
  const schema: SchemaTable[] = tables.map(table => ({
    name: table.name,
    columns: table.columns.map(column => ({ name: column.name, type: column.dataType, primaryKey: column.primaryKey, foreignTable: column.foreignTable, foreignColumn: column.foreignColumn, nullable: column.nullable })),
    constraints: table.constraints,
    indexes: table.indexes,
  }));
  const tableByName = new Map(tables.map(table => [table.name.toLowerCase(), table]));
  const references = schemaReferences(schema);
  if (references.length > 500) throw new Error("Schema diagrams can include up to 500 foreign-key relationships at a time.");

  // Pre-compute side assignments and port distribution per table-side pair
  type ConnectorInfo = {
    reference: SchemaReference;
    index: number;
    parent: SchemaTableElement;
    child: SchemaTableElement;
    parentSide: Side;
    childSide: Side;
  };

  const connectorInfos: ConnectorInfo[] = [];
  for (let index = 0; index < references.length; index++) {
    const reference = references[index];
    const parent = tableByName.get(reference.targetTable.name.toLowerCase());
    const child = tableByName.get(reference.sourceTable.name.toLowerCase());
    if (!parent?.id || !child?.id) continue;
    const parentBox = tableCenter(parent);
    const childBox = tableCenter(child);
    const { parentSide, childSide } = bestSides(parentBox, childBox);
    connectorInfos.push({ reference, index, parent, child, parentSide, childSide });
  }

  // Group connectors by (tableId, side) for port distribution
  const portGroups = new Map<string, string[]>();
  for (const info of connectorInfos) {
    const parentKey = `${info.parent.id}:${info.parentSide}`;
    const childKey = `${info.child.id}:${info.childSide}`;
    const connKey = `conn-${info.index}`;
    if (!portGroups.has(parentKey)) portGroups.set(parentKey, []);
    portGroups.get(parentKey)!.push(`${connKey}:start`);
    if (!portGroups.has(childKey)) portGroups.set(childKey, []);
    portGroups.get(childKey)!.push(`${connKey}:end`);
  }

  // Compute distributed anchors
  const distributedAnchors = new Map<string, { x: number; y: number }>();
  for (const [groupKey, portKeys] of portGroups) {
    const side = groupKey.split(":")[1] as Side;
    const distributed = distributePortsOnSide(portKeys, side);
    for (const [portKey, anchor] of distributed) distributedAnchors.set(portKey, anchor);
  }

  return connectorInfos.flatMap((info) => {
    const { reference, index, parent, child, parentSide, childSide } = info;
    const parentField = parent.columns.find(column => column.name.toLowerCase() === reference.targetColumn.name.toLowerCase());
    const childField = child.columns.find(column => column.name.toLowerCase() === reference.sourceColumn.name.toLowerCase());
    if (!parentField || !childField) return [];

    const connKey = `conn-${index}`;
    // For left/right sides with row bindings, use the side's x anchor but keep row-based y
    const useRowAnchor = parentSide === "left" || parentSide === "right";
    const startAnchorBase = distributedAnchors.get(`${connKey}:start`) ?? { x: sideAnchorX(parentSide), y: sideAnchorY(parentSide) };
    const endAnchorBase = distributedAnchors.get(`${connKey}:end`) ?? { x: sideAnchorX(childSide), y: sideAnchorY(childSide) };

    const startAnchor = useRowAnchor ? { x: startAnchorBase.x, y: 0.5 } : startAnchorBase;
    const endAnchor = (childSide === "left" || childSide === "right") ? { x: endAnchorBase.x, y: 0.5 } : endAnchorBase;

    const startBinding = { elementId: parent.id!, rowId: useRowAnchor ? parentField.id : undefined, anchor: startAnchor };
    const endBinding = { elementId: child.id!, rowId: (childSide === "left" || childSide === "right") ? childField.id : undefined, anchor: endAnchor };
    const start = anchorPoint(parent, startBinding.anchor, startBinding.rowId);
    const end = anchorPoint(child, endBinding.anchor, endBinding.rowId);
    return [{
      type: "line" as const,
      id: globalThis.crypto?.randomUUID?.() ?? `schema-link-${index + 1}`,
      schemaDiagramId,
      x: start.x,
      y: start.y,
      w: end.x - start.x,
      h: end.y - start.y,
      color: "#63859d",
      thickness: 1.6,
      lineStyle: "solid" as const,
      startHead: "bar" as const,
      endHead: "crow" as const,
      autoRoute: true,
      lineRoute: "straight" as const,
      startBinding,
      endBinding,
    }];
  });
}
