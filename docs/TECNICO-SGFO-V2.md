# SGFO v2 — Documento técnico

> **Última revisão (documento / produto):** 2026-04-28 — Backlog PDF 5W2H, GUT, dashboard multi-projeto, APIs server PDF, chaves `localStorage` v2 do backlog.

## 1. Visão geral

**SGFO v2** (Sistema de Gestão e Foco Operacional) é uma aplicação web **single-tenant** orientada a módulos operacionais: **Dashboard**, **Custos** (e **Projetos** com Metabase opcional), **Pessoas** (importação de planilha) e **Backlog** (5W2H + matriz GUT, com importação de relatório PDF). A persistência de negócio principal ocorre no **navegador** via **`localStorage`**, com chaves prefixadas `sgfo.*`. Há **API Routes** (Node) para tarefas server-only (extração de texto de PDF, proxy Metabase). O deploy alvo é **Vercel** (Next.js App Router).

**Público-alvo do documento:** desenvolvedores e operações (deploy, backup, extensão para API/banco).

---

## 2. Stack tecnológica

| Camada        | Tecnologia                          |
|---------------|--------------------------------------|
| Framework     | **Next.js 16** (App Router)         |
| UI            | **React 19**                        |
| Estilo        | **Tailwind CSS 4**                 |
| Linguagem     | **TypeScript 5**                    |
| Planilhas     | **SheetJS (`xlsx` 0.18.x)**         |
| PDF (servidor) | **pdf-parse** (texto)              |
| Lint          | **ESLint 9** + `eslint-config-next` |
| Hospedagem    | **Vercel** (típico)                 |

---

## 3. Estrutura de pastas (código) — resumo

```
src/
├── app/
│   ├── page.tsx                 # Dashboard: KPIs agregados, export/import JSON
│   ├── costs/                   # Orçamento + lançamentos por projeto
│   ├── projects/                 # Projetos SGFO (Metabase opcional)
│   ├── people/                  # Cadastro + import
│   ├── backlog/                 # 5W2H + GUT + importar PDF
│   └── api/
│       ├── backlog/import-pdf/  # POST multipart: PDF → itens 5W2H parseados
│       ├── costs/financial-closing/  # POST: PDF fecho financeiro (texto)
│       └── projects/metabase/   # Proxy/integração Metabase
└── lib/
    ├── costs/
    │   ├── types.ts, storage.ts, xlsxImport.ts
    │   └── aggregateAllProjects.ts   # Soma previsto/realizado de *todos* os projetos
    ├── backlog/
    │   ├── justificativas5w2hParser.ts
    │   └── localStorageRead.ts        # v2 + fallback v1
    ├── people/ …
    ├── server/extractPdfText.ts       # Polyfills + pdf-parse (partilhado)
    └── projects/ …
```

---

## 4. Rotas e responsabilidades

| Rota | Função resumida |
|------|-----------------|
| `/` | KPIs: budget **soma de todos os projetos** (previsto vs realizado, **bolsão** = previsto − realizado), pessoas, **backlog** lido de `v2`/`v1`; export/import JSON `sgfo.*` |
| `/costs` | Projeto ativo: orçamento + lançamentos; tabela de projetos abertos/encerrados |
| `/projects` | Carteira de projetos; sync Metabase se `METABASE_*` configurado |
| `/people` | CRUD, import, Zig |
| `/people/import` | Upload planilha aba **BD** |
| `/backlog` | Ações 5W2H, GUT, **importar PDF** (API), criação manual, prioridade G×U×T |
| `POST /api/backlog/import-pdf` | Corpo `multipart/form-data` campo `file` (.pdf) → JSON `{ items, warnings, fileName }` |
| `POST /api/costs/financial-closing` | Idem, parsing de fecho financeiro (texto) |
| `GET/POST /api/projects/metabase/...` | Conforme `metabase` |

---

## 5. Arquitetura lógica

- **Dashboard — Custos:** o cartão e o painel usam `aggregateAllProjectsCostMetrics` (`lib/costs/aggregateAllProjects.ts`): soma de **previsto** (`budget.total`) e **realizado** (soma de `entries[].amount`) em **todos** os projetos (incl. encerrados). **Bolsão** = previsto total − realizado total (pode ser negativo).
- **Dashboard — Backlog:** lê itens com `readBacklogItemsFromLocalStorage` (prioridade **`sgfo.backlog.items.v2`**, depois v1) para o número de ações abertas.
- **Custos:** `ProjectsStore` em `sgfo.costs.projects.v1`, projeto ativo, encerrar/reabrir, upsert por import Excel.
- **Backlog GUT sem PDF explícito:** heurística por Tipo; coordenador ajusta G, U, T no UI; ficheiro `justificativas5w2hParser.ts`.
- **Backup JSON** na Dashboard: mapa de todas as chaves `sgfo.*` (troca de ambiente por domínio).

---

## 6. Persistência (`localStorage`)

| Chave | Conteúdo (conceitual) |
|--------|------------------------|
| `sgfo.costs.projects.v1` | `{ projects, activeProjectId }` |
| `sgfo.people.v1` | Pessoas |
| `sgfo.backlog.items.v2` | Itens backlog atuais (5W2H+GUT, metadados import) |
| `sgfo.backlog.items.v1` | Legado; a página Backlog migra para v2 ao ler |

**Migração custos:** `sgfo.costs.budget.v1` + `sgfo.costs.entries.v1` → formato projetos (one-shot em `storage.ts`).

**Limitação:** dados no browser; backup JSON é o mecanismo oficial de cópia entre hosts.

---

## 7. API Routes (PDF) e deploy

- `runtime: "nodejs"`, `maxDuration` alargado onde necessário.
- `next.config.ts`: `serverExternalPackages: ["pdf-parse", "pdfjs-dist", ...]`; `outputFileTracingIncludes` para trazer o **worker** do `pdfjs` nas rotas que usam `pdf-parse` (`/api/costs/financial-closing`, `/api/backlog/import-pdf`).
- Extração: `lib/server/extractPdfText.ts` (polyfills DOM, `PDFParse`).

---

## 8. Importações

- **Pessoas:** `.xlsx`, aba BD (`bdImport`).
- **Custos orçamento:** `xlsxImport` / wizard em `/costs`.
- **Backlog:** PDF texto modelo com `| Task ID:`; parser em `justificativas5w2hParser.ts`.

---

## 9. Construção e execução local

```bash
npm install
npm run dev     # next dev --webpack
npm run build
npm start
npm run lint
```

---

## 10. Deploy (Vercel)

- Ligar o repositório a um projeto Vercel; `npm run build` no CI.  
- Variáveis: núcleo de negócio não exige `NEXT_PUBLIC_*` obrigatório; **Metabase** usa envs do servidor (ver rota e `.env.example` se existir).  
- Dados em produção: `localStorage` do utilizador no domínio do deploy.  
- Após `git push` na branch conectada, a Vercel gera **deploy** de produção (ou usar `vercel --prod` com CLI autenticada).  
- **Produção verificada** localmente: `next build` OK antes de subir.

---

## 11. Glossário

| Termo | No sistema |
|--------|------------|
| Previsto | `budget.total` por projeto; no dashboard, **soma** de todos |
| Realizado | Soma de `amount` em lançamentos; no dashboard, **soma** global |
| Bolsão | **Previsto total − realizado total** (sobra negativa = estouro) |
| GUT | Gravidade × Urgência × Tendência (1–5) |

---

*Ajustar este ficheiro quando forem adicionados módulos, chaves ou integrações. Nota no Obsidian: ficheiro vivo em `Projetos Cursor/sgfo-v2/docs/TECNICO-SGFO-V2.md`.*
