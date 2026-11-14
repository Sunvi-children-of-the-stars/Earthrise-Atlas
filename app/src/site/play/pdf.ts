/**
 * Direct PDF download of the mission sheet: the sheet is rendered off-screen, captured as a
 * high-resolution image (fonts and colours included), then placed on an A4 page. The libraries
 * are loaded only when the visitor clicks.
 */

/** "earthrise-atlas_malapert-massif_2026-11-14.pdf" */
export function sheetFileName(siteShort: string, start: number): string {
  const slug = siteShort.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `earthrise-atlas_${slug}_${new Date(start).toISOString().slice(0, 10)}.pdf`;
}

const A4 = { w: 210, h: 297, margin: 10 };

/** Position and size (mm) of an image of pxW × pxH on an A4 page, centred, within the margins. */
export function pageFit(pxW: number, pxH: number): { x: number; y: number; w: number; h: number } {
  const maxW = A4.w - 2 * A4.margin, maxH = A4.h - 2 * A4.margin;
  const k = Math.min(maxW / pxW, maxH / pxH);
  const w = pxW * k, h = pxH * k;
  return { x: (A4.w - w) / 2, y: A4.margin, w, h };
}

/**
 * The @font-face rules of a stylesheet that cover basic Latin (or have no unicode-range), with
 * their font URL. Other subsets (latin-ext, devanagari...) are not needed for the sheet.
 */
export function latinFontFaces(css: string): { rule: string; url: string }[] {
  const out: { rule: string; url: string }[] = [];
  for (const rule of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
    const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(rule)?.[1];
    const range = /unicode-range:\s*([^;}]+)/.exec(rule)?.[1];
    if (url && (!range || /U\+0000-00FF/i.test(range))) out.push({ rule, url });
  }
  return out;
}

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob);
});

/**
 * Poppins as self-contained CSS (fonts inlined as data URLs). html-to-image cannot read the
 * cross-origin Google Fonts stylesheet itself; on failure the capture falls back to system fonts.
 */
async function embeddedFontCss(): Promise<string> {
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')];
  const parts: string[] = [];
  for (const link of links) {
    try {
      const css = await (await fetch(link.href)).text();
      for (const f of latinFontFaces(css)) {
        const data = await toDataUrl(await (await fetch(f.url)).blob());
        parts.push(f.rule.replace(f.url, data));
      }
    } catch { /* system font fallback */ }
  }
  return parts.join("\n");
}

/** Captures `node` and downloads it as a one-page A4 PDF. */
export async function downloadSheet(node: HTMLElement, fileName: string, background: string): Promise<void> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  await document.fonts.ready;
  const fontEmbedCSS = await embeddedFontCss();
  // The node waits off-screen (position: fixed, far left); its clone must be put back in view
  const jpg = await toJpeg(node, {
    pixelRatio: 2, quality: 0.92, backgroundColor: background, cacheBust: true, fontEmbedCSS,
    style: { position: "static", left: "0", top: "0" },
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = jpg; });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  // jsPDF wants numbers: resolve any CSS colour ("#000", "black", "rgb(...)") through a canvas
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, A4.w, A4.h, "F");
  const f = pageFit(img.width, img.height);
  pdf.addImage(jpg, "JPEG", f.x, f.y, f.w, f.h);
  pdf.save(fileName);
}
