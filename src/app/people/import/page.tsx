"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  parseBdWorkbook,
  type BdImportResult,
  type BdRowOutcome,
  type BdImportStats,
  type BdMappedColumn,
} from "@/lib/people/bdImport";
import { parseMoneyBRL } from "@/lib/people/types";
import { loadPeopleFromStorage, replaceWithImportedPeople } from "@/lib/people/storage";

const ACCEPT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx";

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

export default function PeopleImportPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<BdImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  useEffect(() => {
    setExistingCount(loadPeopleFromStorage().length);
    setReady(true);
  }, []);

  const onFile = useCallback(async (file: File | null) => {
    setFileName(null);
    setResult(null);
    setParseError(null);
    setExistingCount(loadPeopleFromStorage().length);
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setParseError("Selecione um arquivo .xlsx (Excel 2007+).");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setParseError("Arquivo muito grande. Limite sugerido: 12 MB.");
      return;
    }
    setFileName(file.name);
    try {
      const ab = await file.arrayBuffer();
      setResult(parseBdWorkbook(ab));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Falha ao ler o Excel.");
    }
  }, []);

  const confirm = useCallback(() => {
    if (!result?.canConfirm) return;
    setBusy(true);
    try {
      replaceWithImportedPeople(result.people);
      router.push("/people?imported=1");
      router.refresh();
    } catch {
      setParseError("Não foi possível salvar. Verifique o armazenamento do navegador (modo anônimo, quota).");
    } finally {
      setBusy(false);
    }
  }, [result, router]);

  if (!ready) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#dde5f0" }}>
        <p className="text-sm" style={{ color: "#64748b" }}>Carregando…</p>
      </div>
    );
  }

  const structural = result
    && (result.kind === "no_sheet" || result.kind === "missing_headers");

  return (
    <div className="min-h-full" style={{ background: "#dde5f0" }}>
      <div className="px-8 py-5" style={{ background: "#0c1930", borderBottom: "1px solid #0f2040" }}>
        <p className="text-[10px] font-semibold tracking-widest text-blue-400 mb-1">SGFO · Base organizacional</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-lg font-bold text-white tracking-tight">
            {existingCount > 0
              ? "Reimportar planilha (aba BD)"
              : "Importar base mestre (aba BD)"}
          </h1>
          <Link
            href="/people"
            className="text-sm font-medium shrink-0"
            style={{ color: "#93c5fd" }}
          >
            ← Voltar a Pessoas
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
        {existingCount > 0 ? (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ background: "#e0e7ff", border: "1px solid #a5b4fc", color: "#312e81" }}
          >
            <strong>Reimportação:</strong> você já possui {existingCount} pessoa(s) salvas neste
            navegador. Ao <strong>confirmar</strong> o novo arquivo, a base será
            <strong> substituída integralmente</strong> pelas linhas válidas da aba
            <code className="text-xs mx-0.5"> BD</code> (pessoas cadastradas manualmente que não
            estiverem no Excel deixarão de aparecer).
          </div>
        ) : null}
        <section className="rounded-2xl p-6" style={CARD_OFF_WHITE}>
          <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
            <strong>Fonte única:</strong> o sistema lê <strong>exclusivamente a aba chamada <code className="text-xs">BD</code></strong>.
            Abas como Parâmetros, Resumo Executivo, Grupo A/B, etc. são ignoradas. Envie
            <code className="text-xs bg-slate-100 px-1 rounded"> .xlsx</code> (Excel). Sempre
            que precisar alinhar com a planilha atualizada, reimporte aqui — os dados no
            navegador serão <strong>substituídos</strong> após a confirmação.
          </p>
          <p className="mt-3 text-xs" style={{ color: "#94a3b8" }}>
            <strong>Colunas obrigatórias (aba BD):</strong> Colaborador, Cargo, Filial, Salário
            Base, Média Freelancer. <strong>Opcionais:</strong> Custo Zig (Custo Zig atual, etc.),
            Gestor, Nota Comportamento, Nota
            Entrega, Classificação, Mérito, Promoção, Talento. Status no sistema:{" "}
            <strong>Ativo</strong> (automático). Se existir a coluna <strong>Custo Zig</strong>{" "}
            (ou <em>Custo Zig atual</em>), o valor vira o Custo Zig do sistema; sem essa
            coluna, usa o Salário Base.
          </p>
        </section>

        <section className="rounded-2xl p-6" style={CARD_OFF_WHITE}>
          <input
            type="file"
            accept={ACCEPT}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="text-sm w-full"
          />
          {fileName ? <p className="mt-2 text-xs" style={{ color: "#64748b" }}>Selecionado: {fileName}</p> : null}
          {parseError ? (
            <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              {parseError}
            </p>
          ) : null}
        </section>

        {result && result.kind === "no_sheet" ? (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b" }}
          >
            {result.message}
          </div>
        ) : null}

        {result && result.kind === "missing_headers" && result.missingColumns.length > 0 ? (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "#ffedd5", border: "1px solid #fdba74", color: "#9a3412" }}
          >
            <p className="font-semibold">Faltam colunas obrigatórias (aba BD).</p>
            <p className="mt-1">Colunas ausentes: {result.missingColumns.join(", ")}</p>
          </div>
        ) : null}

        {result && (result.mapped.length > 0 || result.unmappedHeaders.length > 0) ? (
          <MappingBlock mapped={result.mapped} unmapped={result.unmappedHeaders} />
        ) : null}

        {result && !structural && (result.rowOutcomes.length > 0 || result.stats) ? (
          <StatsBlock stats={result.stats} rowCount={result.rowOutcomes.length} />
        ) : null}

        {result && !structural && result.rowOutcomes.length > 0 ? <ImportTable result={result} /> : null}

        {result && existingCount > 0 && result.canConfirm ? (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e" }}
          >
            <strong>Atenção:</strong> já existem {existingCount} pessoa(s) na base local. Ao
            confirmar, <strong>tudo será substituído</strong> pelas linhas válidas da aba
            <strong> BD</strong>.
          </div>
        ) : null}

        {result && !structural ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" style={{ color: "#475569" }}>{result.summary}</p>
            <button
              type="button"
              disabled={!result.canConfirm || busy}
              onClick={confirm}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: result.canConfirm ? "#059669" : "#94a3b8" }}
            >
              {busy
                ? "Gravando…"
                : existingCount > 0
                  ? "Confirmar reimportação"
                  : "Confirmar importação"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CARD_OFF_WHITE: CSSProperties = {
  background: "#fff",
  border: "1px solid #c8d4e8",
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
};

function StatsBlock({ stats, rowCount }: { stats: BdImportStats | null; rowCount: number }) {
  if (!rowCount) return null;
  return (
    <section className="rounded-2xl p-5" style={CARD_OFF_WHITE}>
      <h2 className="text-sm font-bold text-slate-900 mb-3">Resumo da leitura (pré-salvamento)</h2>
      {stats ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm" style={{ color: "#334155" }}>
          <li><strong>Total de pessoas (válidas):</strong> {stats.totalPessoas}</li>
          <li>
            <strong>Total por filial:</strong>{" "}
            {stats.porFilial.length
              ? stats.porFilial.map((f) => `${f.filial} (${f.count})`).join(" · ")
              : "—"}
          </li>
          <li>
            <strong>Custo salarial total (soma Salário Base):</strong> {brl(stats.custoSalarialTotal)}
          </li>
          <li>
            <strong>Média geral (Média Freelancer, média aritmética entre colaboradores):</strong> {brl(stats.mediaFreelancerMedia)}
          </li>
        </ul>
      ) : (
        <p className="text-sm" style={{ color: "#b45309" }}>Nenhuma linha válida ainda; estatísticas aparecem quando houver pessoas sem erros de leitura.</p>
      )}
    </section>
  );
}

function MappingBlock({ mapped, unmapped }: { mapped: BdMappedColumn[]; unmapped: string[] }) {
  return (
    <section className="rounded-2xl p-5" style={CARD_OFF_WHITE}>
      <h2 className="text-sm font-bold text-slate-900 mb-3">Mapeamento das colunas (aba BD)</h2>
      <p className="text-xs mb-3" style={{ color: "#64748b" }}>
        Confira se a coluna correta da planilha foi reconhecida. Cabeçalhos não detectados
        ficam em cinza e podem ser preenchidos manualmente depois (na tela de Pessoas).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {mapped.map((m) => (
          <div
            key={m.display}
            className="flex items-center justify-between py-1"
            style={{ borderBottom: "1px dashed #e2e8f0" }}
          >
            <span className="font-medium" style={{ color: "#0f172a" }}>{m.display}</span>
            <span
              className="ml-3 truncate text-right"
              title={m.excelHeader ?? "Não detectada"}
              style={{ color: m.excelHeader ? "#047857" : "#94a3b8" }}
            >
              {m.excelHeader ? `→ ${m.excelHeader}` : "— não detectada —"}
            </span>
          </div>
        ))}
      </div>
      {unmapped.length > 0 ? (
        <p className="mt-3 text-[11px]" style={{ color: "#94a3b8" }}>
          <strong>Outras colunas presentes na aba BD (ignoradas pelo sistema):</strong>{" "}
          {unmapped.join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function ImportTable({ result }: { result: BdImportResult }) {
  return (
    <section
      className="space-y-3 rounded-2xl p-4 overflow-x-auto"
      style={CARD_OFF_WHITE}
    >
      <div className="px-1 pb-2" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <h2 className="text-sm font-bold text-slate-900">Prévia linha a linha (aba BD)</h2>
        <p className="text-xs mt-1" style={{ color: "#64748b" }}>
          Aba lida: <span className="font-medium text-slate-800">{result.sheetName || "—"}</span>
        </p>
      </div>
      <div className="min-w-[1100px]">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="text-left" style={{ background: "#f8fbff" }}>
              <th className="px-2 py-2">Linha</th>
              <th className="px-2 py-2">Colaborador</th>
              <th className="px-2 py-2">Cargo / Filial</th>
              <th className="px-2 py-2">Sal. base / Méd. Free.</th>
              <th className="px-2 py-2">Notas C/E · Classif. · Talento</th>
              <th className="px-2 py-2">Mérito</th>
              <th className="px-2 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {result.rowOutcomes.map((o) => (
              <PreviewRow key={o.excelRowIndex} o={o} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewRow({ o }: { o: BdRowOutcome }) {
  const p = o.preview;
  const hasErr = o.errors.length > 0;
  const showOk = o.person && !hasErr;
  const s1 = p.salarioBase ? (parseMoneyBRL(p.salarioBase) !== null ? brl(parseMoneyBRL(p.salarioBase)!) : p.salarioBase) : "—";
  const s2 = p.mediaFreelancer ? (parseMoneyBRL(p.mediaFreelancer) !== null ? brl(parseMoneyBRL(p.mediaFreelancer)!) : p.mediaFreelancer) : "—";
  const s3 = p.custoZig?.trim()
    ? (parseMoneyBRL(p.custoZig) !== null ? brl(parseMoneyBRL(p.custoZig)!) : p.custoZig)
    : "— (usa SB)";

  return (
    <tr
      className="align-top"
      style={
        hasErr
          ? { background: "rgba(254,202,202,0.35)" }
          : showOk
            ? { background: "rgba(209,250,229,0.35)" }
            : { background: "#fff" }
      }
    >
      <td className="px-2 py-1.5 tabular-nums" style={{ borderBottom: "1px solid #f1f5f9" }}>{o.excelRowIndex}</td>
      <td className="px-2 py-1.5 font-medium" style={{ borderBottom: "1px solid #f1f5f9", color: "#0f172a" }}>{p.colaborador || "—"}</td>
      <td className="px-2 py-1.5" style={{ color: "#475569", borderBottom: "1px solid #f1f5f9" }}>
        {[p.cargo, p.filial].filter(Boolean).join(" · ") || "—"}
        <br />
        <span className="text-[10px] opacity-90">Gestor: {p.gestor?.trim() || "—"}</span>
      </td>
      <td className="px-2 py-1.5" style={{ color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>
        SB: {s1} <br /> CZ: {s3} <br /> MF: {s2}
      </td>
      <td className="px-2 py-1.5" style={{ color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>
        C:{p.notaComportamento || "—"} E:{p.notaEntrega || "—"}<br />
        {p.classificacao || "—"}<br />
        Pr:{p.promocao || "—"} · T:{p.talento || "—"}
      </td>
      <td className="px-2 py-1.5" style={{ color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>{p.merit || "—"}</td>
      <td className="px-2 py-1.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
        {hasErr ? (
          <ul className="list-disc pl-3 space-y-0.5" style={{ color: "#b91c1c" }}>
            {o.errors.map((e, j) => (
              <li key={`${o.excelRowIndex}-${j}`}>{e}</li>
            ))}
          </ul>
        ) : showOk && o.person ? (
          <span className="font-medium" style={{ color: "#047857" }}>Válida (Ativo; Zig = Custo Zig da planilha ou Salário Base)</span>
        ) : null}
      </td>
    </tr>
  );
}
