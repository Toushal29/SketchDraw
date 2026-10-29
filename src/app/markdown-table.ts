export type MarkdownTableBlock = { start: number; end: number; text: string };
export function findMarkdownTableBlock(content: string): MarkdownTableBlock | undefined {
  const lines = content.split(/\r?\n/);
  const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(value => value.trim());
  let fence: { marker: "`" | "~"; length: number } | undefined;
  for (let start = 0; start < lines.length - 1; start++) {
    const fenceLine = /^\s*(`{3,}|~{3,})/.exec(lines[start]);
    if (fenceLine) {
      const marker = fenceLine[1][0] as "`" | "~";
      if (!fence) fence = { marker, length: fenceLine[1].length };
      else if (marker === fence.marker && fenceLine[1].length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    const header = lines[start]; const divider = lines[start + 1];
    if (!header.includes("|") || !divider.includes("|")) continue;
    const headerCells = cells(header); const dividerCells = cells(divider);
    if (headerCells.length < 2 || dividerCells.length !== headerCells.length || !dividerCells.every(value => /^:?-{3,}:?$/.test(value))) continue;
    let end = start + 2;
    while (end < lines.length && lines[end].includes("|") && cells(lines[end]).length === headerCells.length) end++;
    return { start, end, text: lines.slice(start, end).join("\n") };
  }
  return undefined;
}
export function replaceMarkdownTableBlock(content: string, block: MarkdownTableBlock, replacement: string): string {
  const lines = content.split(/\r?\n/); lines.splice(block.start, block.end - block.start, ...replacement.split(/\r?\n/)); return lines.join("\n");
}
