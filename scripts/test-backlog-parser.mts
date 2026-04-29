import fs from "node:fs";
import { parseJustificativas5w2hText } from "../src/lib/backlog/justificativas5w2hParser";
import { PDFParse } from "pdf-parse";

const buf = new Uint8Array(
  fs.readFileSync(
    process.argv[2] ||
      "/Users/thiagoperazzo/Library/Application Support/Cursor/User/workspaceStorage/258d07b7c9529b7f894c5062260f8602/pdfs/1c35ae21-ce66-4f10-bb97-dde23d0fd3d7/RELATORIO DE JUSTIFICATIVAS OPERACIONAIS 5w2h (1).pdf"
  )
);
const p = new PDFParse({ data: buf });
const { text } = await p.getText({ lineEnforce: true });
await p.destroy();
const { items, warnings } = parseJustificativas5w2hText(text);
console.log("warnings", warnings);
console.log("count", items.length);
console.log(JSON.stringify(items[0], null, 2));
console.log("last", items[items.length - 1]?.title, items[items.length - 1]?.what?.slice(0, 60));
