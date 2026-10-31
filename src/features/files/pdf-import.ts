import { ALT_TEXT_MAX_LENGTH } from "../accessibility/accessibility";

export const MAX_PDF_IMPORT_PAGES = 50;
export const MAX_PDF_IMPORT_BYTES = 100_000_000;
/** Longest raster side. Keeps a page sharp when zoomed in without bloating the .sketch file. */
const MAX_RENDER_SIDE = 2000;
/** Combined size cap for embedded page images, counted as base64 characters. */
const MAX_TOTAL_IMAGE_CHARS = 60_000_000;

export type PdfPageImage = {
  dataUrl: string;
  /** Page size in PDF points, which becomes the page's size on the canvas. */
  width: number;
  height: number;
  /** Raster size of the embedded image. */
  pixelWidth: number;
  pixelHeight: number;
  /** Extracted page text, used as the image's alt text. */
  text: string;
};

export type PdfImportResult = { pages: PdfPageImage[]; pageCount: number; truncated: boolean };

export function isPdfBytes(bytes: Uint8Array): boolean {
  // The signature may follow up to 1 KB of leading bytes.
  const head = String.fromCharCode(...bytes.subarray(0, Math.min(bytes.length, 1024)));
  return head.includes("%PDF-");
}

/** Renders PDF pages to embedded images so they can be marked up with the normal drawing tools. */
export async function renderPdfPages(bytes: Uint8Array, options: { maxPages?: number; onProgress?: (done: number, total: number) => void; isCancelled?: () => boolean } = {}): Promise<PdfImportResult> {
  if (bytes.length > MAX_PDF_IMPORT_BYTES) throw new Error("This PDF is larger than the 100 MB import limit.");
  if (!isPdfBytes(bytes)) throw new Error("The selected file is not a PDF document.");
  // The legacy build runs in older Android WebViews; the worker is bundled as a same-origin asset.
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  const pdf = await task.promise;
  try {
    const limit = Math.max(1, Math.min(options.maxPages ?? MAX_PDF_IMPORT_PAGES, MAX_PDF_IMPORT_PAGES));
    const total = Math.min(pdf.numPages, limit);
    const pages: PdfPageImage[] = [];
    let imageChars = 0; let truncated = pdf.numPages > total;
    for (let number = 1; number <= total; number++) {
      if (options.isCancelled?.()) break;
      const page = await pdf.getPage(number);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.max(1, Math.min(3, MAX_RENDER_SIDE / Math.max(base.width, base.height)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width)); canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create a drawing surface for the PDF page.");
        context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, canvas, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", .92);
        canvas.width = 0; canvas.height = 0;
        if (imageChars + dataUrl.length > MAX_TOTAL_IMAGE_CHARS) { truncated = true; break; }
        imageChars += dataUrl.length;
        let text = "";
        try { text = (await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim().slice(0, ALT_TEXT_MAX_LENGTH); } catch { /* A page without extractable text still imports as an image. */ }
        pages.push({ dataUrl, width: base.width, height: base.height, pixelWidth: Math.round(viewport.width), pixelHeight: Math.round(viewport.height), text });
      } finally { page.cleanup(); }
      options.onProgress?.(number, total);
    }
    return { pages, pageCount: pdf.numPages, truncated: truncated || pages.length < pdf.numPages };
  } finally { void task.destroy(); }
}
