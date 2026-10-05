export function indentTextarea(event: KeyboardEvent, setValue: (value: string) => void) {
  const textarea = event.currentTarget as HTMLTextAreaElement;
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  event.preventDefault();
  const value = textarea.value; const start = textarea.selectionStart; const end = textarea.selectionEnd;
  const unit = "  ";
  if (start === end) {
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    let next = value; let caret = start;
    if (event.shiftKey) {
      const lineEndAt = value.indexOf("\n", start); const lineEnd = lineEndAt < 0 ? value.length : lineEndAt;
      const line = value.slice(lineStart, lineEnd); const match = /^(\t| {1,2})/.exec(line); const remove = match?.[0].length ?? 0;
      if (remove) { next = value.slice(0, lineStart) + line.slice(remove) + value.slice(lineEnd); caret -= Math.min(remove, Math.max(0, start - lineStart)); }
    } else { next = value.slice(0, start) + unit + value.slice(end); caret += unit.length; }
    setValue(next);
    requestAnimationFrame(() => { if (textarea.isConnected) textarea.setSelectionRange(caret, caret); });
    return;
  }
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const blockEnd = end > lineStart && value[end - 1] === "\n" ? end - 1 : (value.indexOf("\n", end) < 0 ? value.length : value.indexOf("\n", end));
  const lines = value.slice(lineStart, blockEnd).split("\n"); let firstDelta = 0; let totalDelta = 0;
  const changed = lines.map((line, index) => {
    if (event.shiftKey) {
      const match = /^(\t| {1,2})/.exec(line); const next = match ? line.slice(match[0].length) : line; const delta = line.length - next.length;
      if (index === 0) firstDelta = -delta; totalDelta -= delta; return next;
    }
    if (index === 0) firstDelta = unit.length; totalDelta += unit.length; return unit + line;
  }).join("\n");
  const next = value.slice(0, lineStart) + changed + value.slice(blockEnd);
  setValue(next);
  requestAnimationFrame(() => { if (textarea.isConnected) textarea.setSelectionRange(Math.max(lineStart, start + firstDelta), Math.max(lineStart, end + totalDelta)); });
}
