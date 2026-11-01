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

  return references.flatMap((reference, index) => {
    const parent = tableByName.get(reference.targetTable.name.toLowerCase());
    const child = tableByName.get(reference.sourceTable.name.toLowerCase());
    const parentField = parent?.columns.find(column => column.name.toLowerCase() === reference.targetColumn.name.toLowerCase());
    const childField = child?.columns.find(column => column.name.toLowerCase() === reference.sourceColumn.name.toLowerCase());
    if (!parent?.id || !child?.id || !parentField || !childField) return [];

    const parentIsLeft = parent.x + parent.w / 2 <= child.x + child.w / 2;
    const startBinding = { elementId: parent.id, rowId: parentField.id, anchor: { x: parentIsLeft ? 1 : 0, y: .5 } };
    const endBinding = { elementId: child.id, rowId: childField.id, anchor: { x: parentIsLeft ? 0 : 1, y: .5 } };
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
