import type { Bounds, CanvasState, Element, FontFamily, ImageElement, Point, ShapeElement, TextElement, Theme } from "../../model";
import { isConnector, isLabelShape, textLayout } from "../../operations";
import { arrowHeadEntries, arrowHeadSvgPath, connectorSvgPath, flowchartSvgDetailPath, vectorFlowchartPath } from "../canvas/geometry";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { themeInk } from "../canvas/rendering";
import { stylusStrokeWidth } from "../canvas/freehand-rendering";
import { drawNoteCard } from "../../notes";

export type PdfRasterPage = { jpeg: Uint8Array; imageWidth: number; imageHeight: number; pageWidth: number; pageHeight: number; x: number; y: number; drawWidth: number; drawHeight: number; bleedPt: number; grayscale: boolean };

type PdfRenderPorts = {
  pdfColorMode: () => "rgb" | "cmyk" | "grayscale";
  pdfBleedMm: () => number;
  pdfHeader: () => string;
  pdfFooter: () => string;
  pdfCropMarks: () => boolean;
  imageCache: Map<string, HTMLImageElement>;
  theme: () => Theme;
  componentAppearance: () => "simple" | "modern";
  simpleComponentElement: (element: Element) => Element;
  drawElement: (context: CanvasRenderingContext2D, element: Element, viewport?: Bounds, sourceItems?: Element[]) => void;
  drawNoteCard: typeof drawNoteCard;
};
export function imagePdfPages(pages: PdfRasterPage[], options: Pick<PdfRenderPorts, "pdfHeader" | "pdfFooter" | "pdfCropMarks">): Uint8Array {
    const { pdfHeader, pdfFooter, pdfCropMarks } = options;
    const encoder = new TextEncoder(); const parts: Uint8Array[] = []; const offsets: number[] = []; let size = 0;
    const add = (part: Uint8Array) => { parts.push(part); size += part.length; };
    const ascii = (text: string) => encoder.encode(text);
    const object = (id: number, body: Uint8Array) => { offsets[id] = size; add(ascii(`${id} 0 obj\n`)); add(body); add(ascii("\nendobj\n")); };
    const pageIds = pages.map((_, index) => 4 + index * 3);
    const maxId = 3 + pages.length * 3;
    add(ascii("%PDF-1.4\n%SketchDraw\n"));
    object(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
    object(2, ascii(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));
    object(3, ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
    pages.forEach((page, index) => {
      const pageId = pageIds[index]; const imageId = pageId + 1; const contentId = pageId + 2; const imageName = `Im${index}`; const bleed = page.bleedPt;
      const width = page.pageWidth + bleed * 2; const height = page.pageHeight + bleed * 2;
      object(pageId, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /TrimBox [${bleed} ${bleed} ${bleed + page.pageWidth} ${bleed + page.pageHeight}] /Resources << /Font << /F1 3 0 R >> /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
      offsets[imageId] = size; add(ascii(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Interpolate true /Length ${page.jpeg.length} >>\nstream\n`)); add(page.jpeg); add(ascii("\nendstream\nendobj\n"));
      const escapePdf = (value: string) => value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
      const header = pdfHeader().trim() ? `BT /F1 9 Tf ${bleed + 18} ${height - bleed - 16} Td (${escapePdf(pdfHeader())}) Tj ET\n` : "";
      const footer = pdfFooter().trim() ? `BT /F1 9 Tf ${bleed + 18} ${bleed + 8} Td (${escapePdf(pdfFooter())}) Tj ET\n` : "";
      const pageNo = `BT /F1 9 Tf ${width - bleed - 52} ${bleed + 8} Td (Page ${index + 1} of ${pages.length}) Tj ET\n`;
      const t = bleed; const marks = pdfCropMarks() ? `0 G .35 w ${t - 7} ${t} m ${t - 2} ${t} l S ${t} ${t - 7} m ${t} ${t - 2} l S ${width - t + 2} ${t} m ${width - t + 7} ${t} l S ${width - t} ${t - 7} m ${width - t} ${t - 2} l S ${t - 7} ${height - t} m ${t - 2} ${height - t} l S ${t} ${height - t + 2} m ${t} ${height - t + 7} l S ${width - t + 2} ${height - t} m ${width - t + 7} ${height - t} l S ${width - t} ${height - t + 2} m ${width - t} ${height - t + 7} l S\n` : "";
      const content = ascii(`q\n${page.drawWidth} 0 0 ${page.drawHeight} ${page.x + bleed} ${page.y + bleed} cm\n/${imageName} Do\nQ\n${header}${footer}${pageNo}${marks}`);
      object(contentId, new Uint8Array([...ascii(`<< /Length ${content.length} >>\nstream\n`), ...content, ...ascii("\nendstream")]));
    });
    const xrefStart = size; let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxId; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    add(ascii(`${xref}trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
    const output = new Uint8Array(size); let cursor = 0; for (const part of parts) { output.set(part, cursor); cursor += part.length; } return output;
  }

export async function makeVectorPdf(scenes: { items: Element[]; view: CanvasState }[], output: { widthPt: number; heightPt: number }, marginMm: number, ports: PdfRenderPorts) {
  const { pdfColorMode, pdfBleedMm, pdfHeader, pdfFooter, pdfCropMarks, imageCache, theme, componentAppearance, simpleComponentElement, drawElement, drawNoteCard } = ports;
  let textMeasureContext: CanvasRenderingContext2D | null | undefined;
    const { PDFDocument, StandardFonts, LineCapStyle, degrees, rgb, cmyk, pushGraphicsState, popGraphicsState, translate, rotateDegrees } = await import("pdf-lib");
    const pdfColor = (color: string, mode: "rgb" | "cmyk" | "grayscale") => { const match=/^#([\da-f]{6})$/i.exec(color);if(!match)return rgb(.12,.12,.12);const channels=[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)/255);if(mode==="grayscale"){const gray=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;return rgb(gray,gray,gray);}if(mode==="cmyk"){const black=1-Math.max(...channels);const divisor=1-black||1;return cmyk((1-channels[0]-black)/divisor,(1-channels[1]-black)/divisor,(1-channels[2]-black)/divisor,black);}return rgb(channels[0],channels[1],channels[2]);};
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica); const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique); const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique); const fontMono = await doc.embedFont(StandardFonts.Courier);
    const fontSerif = await doc.embedFont(StandardFonts.TimesRoman); const fontSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold); const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic); const fontSerifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
    // Standard PDF fonts use WinAnsi, so normalize text before measuring or drawing it.
    const pdfText = (text: string) => text.replace(/[→⇒]/g, "->").replace(/[←⇐]/g, "<-").replace(/↔/g, "<->").replace(/[^\x20-\xff]/g, "?");
    const grayscale = pdfColorMode() === "grayscale"; const bleed = Math.max(0, Math.min(20, pdfBleedMm())) * 72 / 25.4; const margin = marginMm * 72 / 25.4; textMeasureContext ??= document.createElement("canvas").getContext("2d");
    const paperW = output.widthPt + bleed * 2; const paperH = output.heightPt + bleed * 2;
    const readImage = async (element: ImageElement) => {
      let image = imageCache.get(element.dataUrl);
      if (!image) { image = new Image(); image.src = element.dataUrl; imageCache.set(element.dataUrl, image); }
      await image.decode();
      const cropX=element.cropX??0,cropY=element.cropY??0,cropW=element.cropW??image.naturalWidth,cropH=element.cropH??image.naturalHeight; const cropped=cropX!==0||cropY!==0||cropW!==image.naturalWidth||cropH!==image.naturalHeight; if(grayscale||cropped){const gray=document.createElement("canvas");gray.width=Math.max(1,Math.round(cropW));gray.height=Math.max(1,Math.round(cropH));const context=gray.getContext("2d");if(context){context.drawImage(image,cropX,cropY,cropW,cropH,0,0,gray.width,gray.height);if(grayscale){const pixels=context.getImageData(0,0,gray.width,gray.height);for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;}context.putImageData(pixels,0,0);}const blob=await new Promise<Blob>((resolve,reject)=>gray.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare an imported image for PDF.")),"image/png"));return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));}}
      const data = element.dataUrl.slice(0, element.dataUrl.indexOf(",")); const bytes = Uint8Array.from(atob(element.dataUrl.slice(element.dataUrl.indexOf(",") + 1)), char => char.charCodeAt(0));
      if (data.includes("image/png")) return doc.embedPng(bytes);
      if (data.includes("image/jpeg")) return doc.embedJpg(bytes);
      const temp = document.createElement("canvas"); temp.width = image.naturalWidth; temp.height = image.naturalHeight; temp.getContext("2d")!.drawImage(image, 0, 0); const blob = await new Promise<Blob>((resolve, reject) => temp.toBlob(value => value ? resolve(value) : reject(new Error("Could not encode an imported image for PDF.")), "image/png")); return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
    };
    const pathStyle = (page: import("pdf-lib").PDFPage, path: string, element: ShapeElement, scale: number, originX: number, originY: number, fill?: string, fillAlpha?: number) => {
      const dash = element.lineStyle === "dashed" ? [element.thickness * scale * 4, element.thickness * scale * 2.5] : element.lineStyle === "dotted" ? [element.thickness * scale, element.thickness * scale * 2.2] : undefined;
      const centerX=originX+(element.x+element.w/2)*scale; const centerY=originY-(element.y+element.h/2)*scale; const rotated=!!element.rotation;
      if(rotated)page.pushOperators(pushGraphicsState(),translate(centerX,centerY),rotateDegrees(-(element.rotation??0)),translate(-centerX,-centerY));
      page.drawSvgPath(path, { x: originX, y: originY, scale, color: fill ? pdfColor(fill, pdfColorMode()) : undefined, opacity: fill ? fillAlpha ?? (element.opacity ?? 1) * (element.fillOpacity ?? .2) : 1, borderColor: pdfColor(themeInk(element.color, theme()), pdfColorMode()), borderWidth: element.thickness * scale, borderOpacity: element.opacity ?? 1, borderDashArray: dash, borderLineCap: LineCapStyle.Round });
      if(rotated)page.pushOperators(popGraphicsState());
    };
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex]; const visible = scene.items.filter(item => !item.hidden); const raw = unionBounds(visible.map(elementBounds)) ?? { x: 0, y: 0, w: 800, h: 600 }; const padding = 24; const bounds = { x: raw.x - padding, y: raw.y - padding, w: Math.max(1, raw.w + padding * 2), h: Math.max(1, raw.h + padding * 2) };
      const usableW = output.widthPt - margin * 2; const usableH = output.heightPt - margin * 2; const scale = Math.max(.001, Math.min(usableW / bounds.w, usableH / bounds.h)); const x0 = bleed + margin - bounds.x * scale; const yTop = paperH - bleed - margin + bounds.y * scale;
      const page = doc.addPage([paperW, paperH]); page.setTrimBox(bleed, bleed, output.widthPt, output.heightPt); page.setBleedBox(0, 0, paperW, paperH);
      const drawText = (text: string, x: number, y: number, color: string, size: number, family: FontFamily | undefined, bold: boolean, italic: boolean, opacity: number, rotation = 0, rotationCenter?: Point, align: TextElement["textAlign"] = "left") => {
        const font = family === "mono" ? fontMono : family === "serif" ? bold && italic ? fontSerifBoldItalic : bold ? fontSerifBold : italic ? fontSerifItalic : fontSerif : family === "hand" ? bold ? fontBoldItalic : fontItalic : bold && italic ? fontBoldItalic : bold ? fontBold : italic ? fontItalic : fontRegular;
        const safeText = pdfText(text);
        let tx=x,ty=y;const textWidth=font.widthOfTextAtSize(safeText,size*scale)/scale;if(align==="center")tx-=textWidth/2;else if(align==="right")tx-=textWidth;if(rotation&&rotationCenter){const angle=rotation*Math.PI/180,dx=tx-rotationCenter.x,dy=y-rotationCenter.y;tx=rotationCenter.x+dx*Math.cos(angle)-dy*Math.sin(angle);ty=rotationCenter.y+dx*Math.sin(angle)+dy*Math.cos(angle);}
        page.drawText(safeText, { x: x0 + tx * scale, y: paperH - (bleed + margin + (ty - bounds.y) * scale) - size * scale, size: size * scale, font, color: pdfColor(themeInk(color, theme()), pdfColorMode()), opacity, rotate: degrees(-rotation) });
      };
      const drawItem = async (element: Element): Promise<void> => {
        if (element.hidden) return;
        element = simpleComponentElement(element);
        if (element.type === "group") {
          if (element.note) {
            try {
              const box = elementBounds(element); const width = Math.max(1, Math.abs(box.w)), height = Math.max(1, Math.abs(box.h));
              const ratio = Math.max(.01, Math.min(2, 8192 / width, 8192 / height, Math.sqrt(16_000_000 / (width * height))));
              const surface = document.createElement("canvas"); surface.width = Math.max(1, Math.ceil(width * ratio)); surface.height = Math.max(1, Math.ceil(height * ratio));
              const context = surface.getContext("2d"); if (!context) throw new Error("Canvas renderer unavailable");
              context.setTransform(ratio, 0, 0, ratio, -box.x * ratio, -box.y * ratio); drawNoteCard(context, element, theme(), componentAppearance());
              const encoded = surface.toDataURL("image/png").split(",")[1]; const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)); const image = await doc.embedPng(bytes);
              const left = x0 + box.x * scale; const top = paperH - (bleed + margin + (box.y - bounds.y) * scale); const centerX = left + box.w * scale / 2; const centerY = top - box.h * scale / 2; const rotated = !!element.rotation;
              if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
              page.drawImage(image, { x: left, y: top - box.h * scale, width: box.w * scale, height: box.h * scale });
              if (rotated) page.pushOperators(popGraphicsState());
            } catch { for (const child of element.elements) await drawItem(child); }
            return;
          }
          for (const child of element.elements) await drawItem(child); return;
        }
        if (element.type === "image") { try { const embedded = await readImage(element); const centerX=x0+(element.x+element.w/2)*scale,centerY=paperH-(bleed+margin+(element.y+element.h/2-bounds.y)*scale),rotated=!!element.rotation;if(rotated)page.pushOperators(pushGraphicsState(),translate(centerX,centerY),rotateDegrees(-(element.rotation??0)),translate(-centerX,-centerY));page.drawImage(embedded, { x: x0 + element.x * scale, y: paperH - (bleed + margin + (element.y - bounds.y + element.h) * scale), width: element.w * scale, height: element.h * scale, opacity: element.opacity ?? 1 });if(rotated)page.pushOperators(popGraphicsState()); } catch { /* Keep other vector content even if an embedded image cannot be decoded. */ } return; }
        if (element.type === "text") { const lines = element.text.split(/\r?\n/).map((line,index)=>element.listType==="bullet"?`• ${line}`:element.listType==="number"?`${index+1}. ${line}`:line); const textBox=elementBounds(element); const center={x:textBox.x+textBox.w/2,y:textBox.y+textBox.h/2}; lines.forEach((line, index) => drawText(line, element.x, element.y + index * element.fontSize * 1.25, element.color, element.fontSize, element.fontFamily, !!element.bold, !!element.italic, element.opacity ?? 1, element.rotation ?? 0, center, element.textAlign)); if (element.underline) { const font = element.fontFamily === "mono" ? fontMono : element.fontFamily === "serif" ? fontSerif : element.fontFamily === "hand" || element.italic ? fontItalic : element.bold ? fontBold : fontRegular; const width = font.widthOfTextAtSize(pdfText(lines[0] ?? ""), element.fontSize) * scale; page.drawLine({ start: { x: x0 + element.x * scale, y: paperH - (bleed + margin + (element.y + element.fontSize) * scale) }, end: { x: x0 + element.x * scale + width, y: paperH - (bleed + margin + (element.y + element.fontSize) * scale) }, thickness: Math.max(.5, scale), color: pdfColor(themeInk(element.color, theme()), pdfColorMode()) }); } return; }
        if (element.type === "schemaTable") {
          const dark = theme() === "dark"; const simple = componentAppearance() === "simple"; const fontSize = element.fontSize ?? 12; const headerHeight = Math.max(42, fontSize * 2.8); const rowHeight = Math.max(30, fontSize * 1.8); const surface = simple ? (dark ? "#202020" : "#ffffff") : (dark ? "#202a35" : "#fbfcfe"); const border = simple ? (dark ? "#b0b0b0" : "#555555") : (dark ? "#506174" : "#9badbf"); const heading = simple ? surface : dark ? "#30465b" : "#e8f0f7"; const ink = simple ? (dark ? "#f0f0f0" : "#262626") : (dark ? "#d8e8f5" : "#36556e"); const left = x0 + element.x * scale; const top = paperH - (bleed + margin + (element.y - bounds.y) * scale); const width = element.w * scale; const height = element.h * scale; const opacity = element.opacity ?? 1;
          const centerX = left + width / 2; const centerY = top - height / 2; const rotated = !!element.rotation;
          if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
          page.drawRectangle({ x: left, y: top - height, width, height, color: pdfColor(surface, pdfColorMode()), opacity, borderColor: pdfColor(border, pdfColorMode()), borderWidth: 1.2 * scale, borderOpacity: opacity });
          page.drawRectangle({ x: left, y: top - headerHeight * scale, width, height: headerHeight * scale, color: pdfColor(heading, pdfColorMode()), opacity });
          drawText(element.name, element.x + 14, element.y + 13, ink, fontSize, "sans", true, false, opacity);
          element.columns.forEach((column, index) => {
            const rowY = element.y + headerHeight + index * rowHeight;
            if (index) page.drawLine({ start: { x: left + 10 * scale, y: top - rowY * scale }, end: { x: left + width - 10 * scale, y: top - rowY * scale }, thickness: .7 * scale, color: pdfColor(simple ? border : dark ? "#394856" : "#e6ebf0", pdfColorMode()), opacity });
            drawText(column.primaryKey ? "PK" : column.foreignTable ? "FK" : "", element.x + 13, rowY + 7, simple ? ink : column.primaryKey ? (dark ? "#f0d58c" : "#826b2f") : (dark ? "#aed9ed" : "#436e85"), 9, "sans", true, false, opacity);
            drawText(column.name, element.x + 44, rowY + 5, simple ? ink : dark ? "#dbe5ee" : "#354759", fontSize * .86, "mono", false, false, opacity);
            drawText(column.dataType || "type", element.x + element.w - 14, rowY + 5, simple ? ink : dark ? "#a4b1bf" : "#768493", fontSize * .78, "mono", false, false, opacity, 0, undefined, "right");
          });
          if (rotated) page.pushOperators(popGraphicsState());
          return;
        }
        if (element.type === "freehand") {
          if (!element.points.length) return;
          const points = element.points;
          if (points.length === 1) {
            const point = points[0]; const pressureAware = point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined;
            const pressure = pressureAware ? stylusStrokeWidth(point, element.thickness) : element.thickness;
            const tilt = pressureAware ? Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90) : 0;
            const radiusX = Math.max(.25, pressure * (pressureAware ? .5 + tilt * .35 : .5) * scale);
            const radiusY = Math.max(.25, pressure * .5 * scale);
            const centerX = x0 + point.x * scale; const centerY = yTop - point.y * scale;
            const rotated = !!element.rotation;
            if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
            page.drawEllipse({ x: centerX, y: centerY, xScale: radiusX, yScale: radiusY, color: pdfColor(themeInk(element.color, theme()), pdfColorMode()), opacity: element.opacity ?? 1 });
            if (rotated) page.pushOperators(popGraphicsState());
            return;
          }
          if (points.some(point => point.pressure !== undefined || point.tiltX !== undefined || point.tiltY !== undefined)) {
            // Preserve the canvas pressure curve and composite opacity once in PDF.
            const bounds = elementBounds(element);
            const box = { x: bounds.x - 1, y: bounds.y - 1, w: bounds.w + 2, h: bounds.h + 2 };
            const ratio = Math.min(Math.max(2, scale * 3), 8192 / box.w, 8192 / box.h, Math.sqrt(16_000_000 / (box.w * box.h)));
            const surface = document.createElement("canvas");
            surface.width = Math.max(1, Math.ceil(box.w * ratio)); surface.height = Math.max(1, Math.ceil(box.h * ratio));
            const context = surface.getContext("2d"); if (!context) throw new Error("Canvas renderer unavailable");
            context.setTransform(ratio, 0, 0, ratio, -box.x * ratio, -box.y * ratio);
            drawElement(context, element);
            const image = await readImage({ type: "image", x: box.x, y: box.y, w: box.w, h: box.h, dataUrl: surface.toDataURL("image/png") });
            page.drawImage(image, { x: x0 + box.x * scale, y: yTop - (box.y + surface.height / ratio) * scale, width: surface.width / ratio * scale, height: surface.height / ratio * scale });
            return;
          }
          let d = `M ${points[0].x} ${points[0].y}`;
          for (let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};d+=` Q ${a.x} ${a.y} ${mid.x} ${mid.y}`;} const last=points[points.length-1];d+=` L ${last.x} ${last.y}`;
          const box = elementBounds(element); const centerX = x0 + (box.x + box.w / 2) * scale; const centerY = yTop - (box.y + box.h / 2) * scale; const rotated = !!element.rotation;
          if (rotated) page.pushOperators(pushGraphicsState(), translate(centerX, centerY), rotateDegrees(-(element.rotation ?? 0)), translate(-centerX, -centerY));
          const ink = pdfColor(themeInk(element.color, theme()), pdfColorMode());
          page.drawSvgPath(d, { x: x0, y: yTop, scale, borderColor: ink, borderWidth: element.thickness * scale, borderOpacity: element.opacity ?? 1, borderLineCap: LineCapStyle.Round });
          if (rotated) page.pushOperators(popGraphicsState()); return;
        }
        const x=element.x,y=element.y,w=element.w,h=element.h; let path="";
        if(element.type==="rectangle") { const l=Math.min(x,x+w),t=Math.min(y,y+h),ww=Math.abs(w),hh=Math.abs(h); const r=element.edgeStyle==="pill"?Math.min(ww,hh)/2:element.edgeStyle==="rounded"?Math.min(element.cornerRadius??14,ww/2,hh/2):0; const c=Math.min(element.cornerRadius??12,ww/2,hh/2); path=element.edgeStyle==="cut"?`M ${l+c} ${t} H ${l+ww-c} L ${l+ww} ${t+c} V ${t+hh-c} L ${l+ww-c} ${t+hh} H ${l+c} L ${l} ${t+hh-c} V ${t+c} Z`:r?`M ${l+r} ${t} H ${l+ww-r} Q ${l+ww} ${t} ${l+ww} ${t+r} V ${t+hh-r} Q ${l+ww} ${t+hh} ${l+ww-r} ${t+hh} H ${l+r} Q ${l} ${t+hh} ${l} ${t+hh-r} V ${t+r} Q ${l} ${t} ${l+r} ${t} Z`:`M ${l} ${t} H ${l+ww} V ${t+hh} H ${l} Z`; }
        else if(element.type==="circle"){const cx=x+w/2,cy=y+h/2,rx=Math.abs(w)/2,ry=Math.abs(h)/2,k=.55228475;path=`M ${cx+rx} ${cy} C ${cx+rx} ${cy+k*ry} ${cx+k*rx} ${cy+ry} ${cx} ${cy+ry} C ${cx-k*rx} ${cy+ry} ${cx-rx} ${cy+k*ry} ${cx-rx} ${cy} C ${cx-rx} ${cy-k*ry} ${cx-k*rx} ${cy-ry} ${cx} ${cy-ry} C ${cx+k*rx} ${cy-ry} ${cx+rx} ${cy-k*ry} ${cx+rx} ${cy} Z`; }
        else if(element.type==="diamond")path=`M ${x+w/2} ${y} L ${x+w} ${y+h/2} L ${x+w/2} ${y+h} L ${x} ${y+h/2} Z`;
        else if(element.type==="triangle"){const l=Math.min(x,x+w),r=Math.max(x,x+w),t=Math.min(y,y+h),b=Math.max(y,y+h);path=`M ${(l+r)/2} ${t} L ${r} ${b} L ${l} ${b} Z`;}
        else if(element.type==="flowchart")path=vectorFlowchartPath(element);
        else {
          const route = element.type === "arrow" ? element.arrowRoute ?? "straight" : element.lineRoute ?? "straight";
          path = connectorSvgPath(element);
          if (element.lineStyle === "double") {
            const normal = { x: -h / Math.max(1, Math.hypot(w, h)), y: w / Math.max(1, Math.hypot(w, h)) };
            const offset = Math.max(2.5, element.thickness * 1.2);
            for (const side of [-1, 1]) {
              const shifted = path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_match, a, b) => `${Number(a) + normal.x * offset * side} ${Number(b) + normal.y * offset * side}`);
              pathStyle(page, shifted, element, scale, x0, yTop);
            }
          } else pathStyle(page, path, element, scale, x0, yTop);
          if (element.type === "arrow" || element.type === "line") for (const head of arrowHeadEntries(element, route)) {
            const radius = Math.max(3, element.thickness * 1.15);
            if (head.kind === "dot") {
              page.drawEllipse({ x: bleed + margin + (head.tip.x - bounds.x) * scale, y: paperH - bleed - margin - (head.tip.y - bounds.y) * scale, xScale: radius * scale, yScale: radius * scale, color: pdfColor(themeInk(element.color, theme()), pdfColorMode()), opacity: element.opacity ?? 1 });
              continue;
            }
            const headPath = arrowHeadSvgPath(head.tip, head.angle, head.kind, element.thickness);
            if (!headPath) continue;
            const filled = ["solid", "thick", "diamond"].includes(head.kind);
            pathStyle(page, headPath, element, scale, x0, yTop, filled ? themeInk(element.color, theme()) : undefined, element.opacity ?? 1);
          }
          if (isLabelShape(element) || isConnector(element)) drawShapeLabel(element, drawText);
          return;
        }
         if(path)pathStyle(page,path,element,scale,x0,yTop,element.fillColor);
        if(element.type==="flowchart"&&element.flowchartShape==="database"){const detail=flowchartSvgDetailPath(element);if(detail)pathStyle(page,detail,element,scale,x0,yTop);}
        if(isLabelShape(element) || isConnector(element))drawShapeLabel(element,drawText);
      };
      const drawShapeLabel=(shape:ShapeElement,draw:(text:string,x:number,y:number,color:string,size:number,family:FontFamily|undefined,bold:boolean,italic:boolean,opacity:number,rotation?:number,rotationCenter?:Point)=>void)=>{if(!shape.label||!textMeasureContext)return;const bounds=elementBounds(shape),center={x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2};for(const run of textLayout(textMeasureContext,shape))draw(run.text,run.x,run.y,shape.label.color,shape.label.fontSize,shape.label.fontFamily,!!shape.label.bold,!!shape.label.italic,shape.label.opacity??1,shape.rotation??0,center);};
      for(const item of visible)await drawItem(item);
      if(pdfHeader().trim())page.drawText(pdfText(pdfHeader()),{x:bleed+margin,y:paperH-bleed-margin+4,size:9,font:fontBold,color:pdfColor("#333333",pdfColorMode())});
      if(pdfFooter().trim())page.drawText(pdfText(pdfFooter()),{x:bleed+margin,y:bleed+margin/2,size:9,font:fontRegular,color:pdfColor("#333333",pdfColorMode())});
      page.drawText(`Page ${sceneIndex+1} of ${scenes.length}`,{x:paperW-bleed-margin-56,y:bleed+margin/2,size:9,font:fontRegular,color:pdfColor("#333333",pdfColorMode())});
      if(pdfCropMarks()){const t=bleed;const marks:{start:{x:number;y:number};end:{x:number;y:number}}[]=[{start:{x:t-7,y:t},end:{x:t-2,y:t}},{start:{x:t,y:t-7},end:{x:t,y:t-2}},{start:{x:paperW-t+2,y:t},end:{x:paperW-t+7,y:t}},{start:{x:paperW-t,y:t-7},end:{x:paperW-t,y:t-2}},{start:{x:t-7,y:paperH-t},end:{x:t-2,y:paperH-t}},{start:{x:t,y:paperH-t+2},end:{x:t,y:paperH-t+7}},{start:{x:paperW-t+2,y:paperH-t},end:{x:paperW-t+7,y:paperH-t}},{start:{x:paperW-t,y:paperH-t+2},end:{x:paperW-t,y:paperH-t+7}}];for(const mark of marks)page.drawLine({...mark,thickness:.35,color:rgb(0,0,0)});}
    }
    return doc.save();
  }
