import { NextResponse } from "next/server";
import { extractPdfTextFromBuffer } from "@/lib/server/extractPdfText";
import { parseJustificativas5w2hText } from "@/lib/backlog/justificativas5w2hParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
    }
    if (!/\.pdf$/i.test(file.name)) {
      return NextResponse.json({ error: "Envie um arquivo .pdf" }, { status: 400 });
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const text = await extractPdfTextFromBuffer(buf);
    const parsed = parseJustificativas5w2hText(text);
    return NextResponse.json({ ...parsed, fileName: file.name });
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : "erro desconhecido";
    const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 4).join(" | ") : null;
    return NextResponse.json(
      { error: `Falha ao processar PDF: ${message}`, stack },
      { status: 500 }
    );
  }
}
