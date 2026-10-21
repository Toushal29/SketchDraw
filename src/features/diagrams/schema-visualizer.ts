import type { SchemaColumn, SchemaTable } from "../../schema";

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
