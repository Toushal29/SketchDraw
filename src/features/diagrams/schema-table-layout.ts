import type { SchemaField, Theme } from "../../model";

const CARD_CONTENT_INSET = 8;
const MARKER_STEP = 18;
const FIELD_TYPE_GAP = 3;

/** Shared dimensions keep cards, field anchors, resizing, and exports in sync. */
export function schemaTableMetrics(fontSize = 12) {
  const size = Math.max(8, Math.min(48, Number.isFinite(fontSize) ? fontSize : 12));
  return {
    fontSize: size,
    titleHeight: Math.max(22, size * 1.8),
    rowHeight: Math.max(17, size * 1.35),
  };
}

/** Uses compact text badges and reserves only the width needed by each row's type label. */
export function schemaTableRowLayout(left: number, width: number, column: SchemaField, fontSize = 12, unique = false) {
  type MarkerKind = "primary" | "foreign" | "required" | "unique";
  type MarkerLabel = "PK" | "FK" | "NN" | "UQ";
  const markers: { kind: MarkerKind; label: MarkerLabel; x: number }[] = [];
  const addMarker = (kind: MarkerKind, label: MarkerLabel) => markers.push({ kind, label, x: left + CARD_CONTENT_INSET + markers.length * MARKER_STEP });
  if (column.primaryKey) addMarker("primary", "PK");
  if (column.foreignTable) addMarker("foreign", "FK");
  if (!column.primaryKey && column.nullable === false) addMarker("required", "NN");
  if (unique && !column.primaryKey) addMarker("unique", "UQ");

  const fieldX = left + CARD_CONTENT_INSET + markers.length * MARKER_STEP + (markers.length ? 2 : 0);
  const typeRight = left + width - CARD_CONTENT_INSET;
  const availableWidth = Math.max(0, typeRight - fieldX);
  const typeFontSize = Math.max(6, fontSize * .7);
  const preferredTypeWidth = Math.max(16, (column.dataType || "type").length * typeFontSize * .62 + 2);
  // Reserve only the actual type label width so resizing gives the field more room.
  const minimumFieldWidth = Math.min(availableWidth, Math.max(24, fontSize * 2.4));
  const typeWidth = Math.min(preferredTypeWidth, Math.max(0, availableWidth - minimumFieldWidth - FIELD_TYPE_GAP));
  const typeStart = typeRight - typeWidth;
  return {
    markers,
    fieldX,
    fieldWidth: Math.max(0, typeStart - fieldX - FIELD_TYPE_GAP),
    typeX: typeStart,
    typeWidth,
    typeRight,
  };
}

/** Allows narrow cards while keeping enough room for their visible content. */
export function schemaTableResizeMinimumWidth() {
  return 120;
}

/** Truncates only the display label; the saved schema keeps its full value. */
export function fitSchemaTableText(value: string, maxWidth: number, fontSize: number) {
  const availableCharacters = Math.floor(Math.max(0, maxWidth) / Math.max(1, fontSize * 0.62));
  if (value.length <= availableCharacters) return value;
  if (availableCharacters < 4) return ".".repeat(availableCharacters);
  return `${value.slice(0, availableCharacters - 3)}...`;
}

/** Sizes new cards to their longest field, type, and table name. */
export function schemaTableMinimumWidth(
  columns: Pick<SchemaField, "name" | "dataType">[],
  fontSize = 12,
  minimumWidth = 190,
  tableName = "",
) {
  const size = schemaTableMetrics(fontSize).fontSize;
  const rowWidth = Math.max(0, ...columns.map(column => column.name.length * size * .82 * .62 + MARKER_STEP + (column.dataType || "type").length * size * .7 * .62 + FIELD_TYPE_GAP + CARD_CONTENT_INSET * 2 + 2));
  const titleWidth = tableName.length * size * .96 * .62 + 20;
  return Math.max(minimumWidth, rowWidth, titleWidth);
}

/** Fits the card to its title and field rows so vertical resizing cannot add blank space. */
export function schemaTableMinimumHeight(columnCount: number, fontSize = 12) {
  const { titleHeight, rowHeight } = schemaTableMetrics(fontSize);
  return titleHeight + Math.max(0, columnCount) * rowHeight;
}

/** Keeps table colors consistent across canvas and exported cards. */
export function schemaTableColors(theme: Theme) {
  return theme === "dark"
    ? { surface: "#202936", header: "#303a49", border: "#515c6b", text: "#e6e9ef", title: "#f3f5f8", muted: "#9ba5b4", divider: "#d4d9e2", primaryKey: "#d99b00", foreignKey: "#c34531", required: "#77768f" }
    : { surface: "#ffffff", header: "#e9edf3", border: "#ccd3dc", text: "#292d36", title: "#242830", muted: "#788293", divider: "#d5dae2", primaryKey: "#c68b00", foreignKey: "#b63e2b", required: "#77768f" };
}
