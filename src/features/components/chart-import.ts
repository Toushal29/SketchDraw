import type { LibraryChartData, LibraryChartSeries } from "../../model";
import { parseCsv } from "../diagrams/csv-diagram";

/** Read a small, header-based CSV table into chart labels and numeric series. */
export function chartDataFromCsv(source: string, labelColumn = 0, selectedSeriesColumns?: number[]): LibraryChartData {
  const { headers, rows } = parseCsv(source);
  if (headers.length < 2) throw new Error("Include a label column and at least one numeric data column.");
  if (!Number.isInteger(labelColumn) || labelColumn < 0 || labelColumn >= headers.length) throw new Error("Choose a valid label column.");
  const seriesColumns = (selectedSeriesColumns ?? headers.map((_, index) => index).filter(index => index !== labelColumn)).filter(index => index !== labelColumn);
  if (!seriesColumns.length) throw new Error("Choose at least one numeric series column.");
  if (seriesColumns.some(index => !Number.isInteger(index) || index < 0 || index >= headers.length)) throw new Error("Choose valid series columns.");
  if (seriesColumns.length > 8) throw new Error("Charts support up to eight data series.");
  if (rows.length > 20) throw new Error("Charts support up to 20 data rows.");
  const labels = rows.map((row, index) => (row[labelColumn] || `Item ${index + 1}`).slice(0, 60));
  const series: LibraryChartSeries[] = seriesColumns.map((column, seriesIndex) => ({
    name: (headers[column] || `Series ${seriesIndex + 1}`).slice(0, 60),
    values: rows.map((row, rowIndex) => {
      const cell = row[column]?.trim() ?? "";
      const value = Number(cell);
      if (!cell || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000) {
        throw new Error(`Row ${rowIndex + 2}, “${headers[column]}” must contain a finite number.`);
      }
      return value;
    }),
  }));
  if (!labels.length) throw new Error("Add at least one data row.");
  return { labels, values: [...series[0].values], series };
}

/** Serialize chart labels and series for editing in the CSV chart wizard. */
export function chartDataToCsv(data: LibraryChartData): string {
  const series = data.series?.length ? data.series : [{ name: data.title || "Series 1", values: data.values }];
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ["Label", ...series.map(item => item.name || "Series")];
  const rows = data.labels.map((label, row) => [label, ...series.map(item => item.values[row] ?? "")]);
  return [header, ...rows].map(row => row.map(escape).join(",")).join("\n");
}
