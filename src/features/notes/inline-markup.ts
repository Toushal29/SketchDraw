export type NoteInlineRun = { text: string; bold: boolean; italic: boolean; underline: boolean; highlight: boolean; strike: boolean; code: boolean };

export function noteInlineRuns(value: string): NoteInlineRun[] {
  const pattern = /(<u>[^<]+<\/u>|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|==[^=]+==|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  const runs: NoteInlineRun[] = [];
  let cursor = 0;
  const plain = (text: string) => { if (text) runs.push({ text, bold: false, italic: false, underline: false, highlight: false, strike: false, code: false }); };
  for (const match of value.matchAll(pattern)) {
    const token = match[0]; const start = match.index ?? 0;
    plain(value.slice(cursor, start));
    const underline = token.startsWith("<u>");
    const bold = token.startsWith("**") || token.startsWith("__");
    const strike = token.startsWith("~~");
    const highlight = token.startsWith("==");
    const code = token.startsWith("`");
    const trim = underline ? 3 : bold || strike || highlight ? 2 : 1;
    runs.push({ text: token.slice(trim, -trim), bold, italic: !underline && !bold && !strike && !highlight && !code, underline, highlight, strike, code });
    cursor = start + token.length;
  }
  plain(value.slice(cursor));
  return runs;
}

export function wrapNoteMarkup(value: string, maxWidth: number, measure: (text: string, run: NoteInlineRun) => number): string[] {
  const lines = [""];
  let lineWidth = 0;
  const encode = (run: NoteInlineRun, text: string) => run.code ? `\`${text}\``
    : run.underline ? `<u>${text}</u>`
    : run.highlight ? `==${text}==`
    : run.strike ? `~~${text}~~`
    : run.bold ? `**${text}**`
    : run.italic ? `*${text}*` : text;
  const append = (run: NoteInlineRun, text: string) => { lines[lines.length - 1] += encode(run, text); lineWidth += measure(text, run); };
  for (const run of noteInlineRuns(value)) {
    const chunks = run.text.match(/[^\s]+\s*|\s+/gu) ?? [];
    for (const chunk of chunks) {
      const width = measure(chunk, run);
      if (!/^\s+$/u.test(chunk) && lineWidth > 0 && lineWidth + width > maxWidth) { lines.push(""); lineWidth = 0; }
      if (width <= maxWidth || /^\s+$/u.test(chunk)) { append(run, chunk); continue; }
      for (const character of Array.from(chunk)) {
        const characterWidth = measure(character, run);
        if (lineWidth > 0 && lineWidth + characterWidth > maxWidth) { lines.push(""); lineWidth = 0; }
        append(run, character);
      }
    }
  }
  return lines;
}
