export type WebPreviewCard = { url: string; dataUrl: string; width: number; height: number };

export function normalizeWebUrl(input: string): string {
  const candidate = input.trim();
  if (!candidate || candidate.length > 2048) throw new Error("Enter a web address up to 2,048 characters.");
  let url: URL;
  try { url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`); }
  catch { throw new Error("Enter a valid web address."); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error("Embedded previews require a public HTTPS address without sign-in details.");
  return url.toString();
}

/** Convert common provider share links into their documented frame URLs. */
export function webEmbedUrl(input: string): string {
  const url = new URL(normalizeWebUrl(input));
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const video = url.pathname.split("/").filter(Boolean)[0];
    if (video && /^[\w-]{6,20}$/.test(video)) return `https://www.youtube-nocookie.com/embed/${video}`;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const video = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,20})/)?.[1];
    if (video) return `https://www.youtube-nocookie.com/embed/${video}`;
  }
  if (host === "vimeo.com") {
    const video = url.pathname.match(/^\/(\d{5,15})/)?.[1];
    if (video) return `https://player.vimeo.com/video/${video}`;
  }
  if (host === "drive.google.com") {
    const file = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1];
    if (file) return `https://drive.google.com/file/d/${file}/preview`;
  }
  if (host === "docs.google.com") {
    const match = url.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
    if (match) return `https://docs.google.com/${match[1]}/d/${match[2]}/preview`;
  }
  return url.toString();
}

export function makeWebPreviewCard(input: string): WebPreviewCard {
  const url = normalizeWebUrl(input); const parsed = new URL(url); const width = 640; const height = 390;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the web preview card.");
  const palette = getComputedStyle(document.querySelector(".app-shell") ?? document.documentElement);
  const color = (token: string) => palette.getPropertyValue(token).trim();
  const background = color("--theme-background"); const surface = color("--theme-surface"); const border = color("--theme-border");
  const textPrimary = color("--theme-text-primary"); const textSecondary = color("--theme-text-secondary"); const primary = color("--theme-primary");
  const success = color("--theme-success"); const warning = color("--theme-warning"); const error = color("--theme-error");
  const host = parsed.hostname.replace(/^www\./, "");
  context.fillStyle = background; context.fillRect(0, 0, width, height);
  context.fillStyle = surface; context.fillRect(0, 0, width, 58);
  context.fillStyle = border; context.fillRect(0, 57, width, 1);
  for (const [buttonColor, index] of [[error, 0], [warning, 1], [success, 2]] as const) { context.fillStyle = buttonColor; context.beginPath(); context.arc(23 + index * 20, 29, 6, 0, Math.PI * 2); context.fill(); }
  context.fillStyle = border; context.fillRect(96, 17, width - 118, 24);
  context.fillStyle = textPrimary; context.font = "600 27px system-ui, sans-serif"; context.fillText(host, 34, 125, width - 68);
  context.fillStyle = textSecondary; context.font = "16px system-ui, sans-serif";
  const hostLine = parsed.pathname.length > 1 ? `${host}${parsed.pathname}` : host;
  context.fillText(hostLine, 34, 158, width - 68);
  const cardX = 34; const cardY = 195; const cardW = width - 68; const cardH = 128; const radius = 12;
  context.fillStyle = surface; context.beginPath(); context.moveTo(cardX + radius, cardY); context.lineTo(cardX + cardW - radius, cardY); context.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + radius, radius); context.lineTo(cardX + cardW, cardY + cardH - radius); context.arcTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH, radius); context.lineTo(cardX + radius, cardY + cardH); context.arcTo(cardX, cardY + cardH, cardX, cardY + cardH - radius, radius); context.lineTo(cardX, cardY + radius); context.arcTo(cardX, cardY, cardX + radius, cardY, radius); context.fill();
  context.strokeStyle = border; context.lineWidth = 1; context.stroke();
  context.fillStyle = primary; context.font = "600 19px system-ui, sans-serif"; context.fillText("Live web preview", 58, 239);
  context.fillStyle = textSecondary; context.font = "16px system-ui, sans-serif"; context.fillText("Double-click this card to load its content", 58, 273);
  context.fillText("Some websites block previews inside other apps", 58, 299);
  context.fillStyle = primary; context.font = "14px system-ui, sans-serif"; context.fillText("HTTPS EMBED", 35, height - 29);
  return { url, dataUrl: canvas.toDataURL("image/png"), width, height };
}
