import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

let workerInitialized = false;

function resolveWorkerPath(): string | null {
  const req = createRequire(import.meta.url);
  const candidates = [
    "pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    "pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  ];
  for (const c of candidates) {
    try {
      return req.resolve(c);
    } catch {
      /* tenta a próxima */
    }
  }
  const roots = [process.cwd(), path.resolve(process.cwd(), "..")];
  const tails = candidates.map((c) => path.join("node_modules", ...c.split("/")));
  for (const r of roots) {
    for (const t of tails) {
      const p = path.join(r, t);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * polyfills mínimos para `pdfjs-dist` em Node (Vercel serverless).
 */
function ensureDomPolyfills() {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix !== "function") {
    class DOMMatrixStub {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      multiply() { return new DOMMatrixStub(); }
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translate() { return new DOMMatrixStub(); }
      translateSelf() { return this; }
      scale() { return new DOMMatrixStub(); }
      scaleSelf() { return this; }
      scale3d() { return new DOMMatrixStub(); }
      rotate() { return new DOMMatrixStub(); }
      rotateSelf() { return this; }
      rotateAxisAngle() { return new DOMMatrixStub(); }
      rotateAxisAngleSelf() { return this; }
      skewX() { return new DOMMatrixStub(); }
      skewY() { return new DOMMatrixStub(); }
      flipX() { return new DOMMatrixStub(); }
      flipY() { return new DOMMatrixStub(); }
      inverse() { return new DOMMatrixStub(); }
      invertSelf() { return this; }
      transformPoint(p: unknown) { return p; }
      toFloat32Array() { return new Float32Array([1, 0, 0, 1, 0, 0]); }
      toFloat64Array() { return new Float64Array([1, 0, 0, 1, 0, 0]); }
      toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
    }
    g.DOMMatrix = DOMMatrixStub as unknown;
  }
  if (typeof g.Path2D !== "function") {
    class Path2DStub {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
    g.Path2D = Path2DStub as unknown;
  }
  if (typeof g.ImageData !== "function") {
    class ImageDataStub {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace = "srgb";
      constructor(arrOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (typeof arrOrWidth === "number") {
          this.width = arrOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(arrOrWidth * widthOrHeight * 4);
        } else {
          this.data = arrOrWidth;
          this.width = widthOrHeight;
          this.height = height ?? arrOrWidth.length / 4 / widthOrHeight;
        }
      }
    }
    g.ImageData = ImageDataStub as unknown;
  }
}

/**
 * Texto do PDF (linhas reforçadas) para parsers que consumam string plana.
 */
export async function extractPdfTextFromBuffer(buf: Uint8Array): Promise<string> {
  ensureDomPolyfills();
  const { PDFParse } = await import("pdf-parse");
  if (!workerInitialized) {
    const workerPath = resolveWorkerPath();
    if (workerPath) {
      try {
        PDFParse.setWorker(pathToFileURL(workerPath).href);
      } catch {
        /* pdf-parse fallback */
      }
    }
    workerInitialized = true;
  }
  const parser = new PDFParse({ data: buf });
  const out = await parser.getText({ lineEnforce: true });
  await parser.destroy();
  return out.text;
}
