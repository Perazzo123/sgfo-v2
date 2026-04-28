# SGFO v2 — Documento técnico

## 1. Visão geral

**SGFO v2** (Sistema de Gestão e Foco Operacional) é uma aplicação web **single-tenant** orientada a módulos operacionais: **Dashboard**, **Custos**, **Pessoas** (com importação de planilha) e **Backlog** (GUT). Não há backend dedicado no repositório: a persistência ocorre no **navegador** via **`localStorage`**, com chaves prefixadas `sgfo.*`. O deploy alvo é **Vercel** (Next.js estático/SSR híbrido do App Router).

**Público-alvo do documento:** desenvolvedores e operações (deploy, backup, extensão para API/banco).

---

## 2. Stack tecnológica

| Camada        | Tecnologia                          |
|---------------|--------------------------------------|
| Framework     | **Next.js 16** (App Router)         |
| UI            | **React 19**                         |
| Estilo        | **Tailwind CSS 4**                 |
| Linguagem     | **TypeScript 5**                    |
| Planilhas     | **SheetJS (`xlsx` 0.18.x)**         |
| Lint          | **ESLint 9** + `eslint-config-next` |
| Hospedagem    | **Vercel** (típico)                 |

Não há ORM, Prisma, nem API Route obrigatória no fluxo atual: toda a lógica de gravação é **client-side** (`"use client"` nas páginas que persistem).

---

## 3. Estrutura de pastas (código)

```
src/
├── app/
│   ├── layout.tsx              # Shell: Sidebar + main
│   ├── page.tsx                # Dashboard
│   ├── globals.css
│   ├── components/
│   │   └── Sidebar.tsx        # Navegação por rotas
│   ├── costs/
│   │   └── page.tsx            # Módulo Custos (orçamento + lançamentos)
│   ├── people/
│   │   ├── page.tsx            # Cadastro e resumos
│   │   └── import/
│   │       └── page.tsx        # Wizard de importação .xlsx (aba BD)
│   └── backlog/
│       └── page.tsx            # Itens GUT
└── lib/
    ├── costs/
    │   ├── types.ts            # Budget, Project, CostEntry, ProjectsStore
    │   ├── storage.ts         # localStorage: projetos, migração legada
    │   └── xlsxImport.ts     # Extração de orçamento a partir de Excel
    └── people/
        ├── types.ts            # Person, helpers de parse
        ├── storage.ts         # localStorage pessoas + flags de import
        ├── parseXlsx.ts        # Leitura genérica de planilha
        └── bdImport.ts         # Mapeamento da aba BD → Person[]
```

---

## 4. Rotas e responsabilidades

| Rota              | Ficheiro                    | Função resumida |
|-------------------|-----------------------------|-----------------|
| `/`               | `app/page.tsx`              | KPIs agregados; export/import JSON de chaves `sgfo.*` |
| `/costs`          | `app/costs/page.tsx`        | Projetos (orçamento + lançamentos), import XLSX de orçamento, encerrar/reabrir, bolsão |
| `/people`         | `app/people/page.tsx`       | Lista, edição, resumo por squad (custo Zig), reimport |
| `/people/import`  | `app/people/import/page.tsx`| Upload e validação da planilha (BD) |
| `/backlog`        | `app/backlog/page.tsx`      | CRUD local de ações e priorização GUT |

Todas as rotas de negócio relevantes são **Client Components** onde a persistência é feita (exceto o layout, que compõe shell).

---

## 5. Arquitetura lógica

- **Modelo híbrido de UI + dados:** o React gerencia o estado; a “fonte da verdade” durável é `localStorage`.
- **Custos** evoluiu de um único `Budget` global para um **`ProjectsStore`**: múltiplos **projetos**, cada um com `status: "open" | "closed"`, orçamento (**previsto**) e **lançamentos** (**realizado**).
- **Chave de projeto:** derivada de `contractId` e/ou `eventName` (`makeProjectId`), com regra de **upsert** na importação Excel (mesmo contrato = atualizar orçamento, preservar lançamentos).
- **Pessoas:** lista normalizada; importação restringe-se à lógica da aba **BD** conforme `bdImport` / `parseXlsx`.
- **Backup entre ambientes:** a Dashboard oferece exportar/importar JSON com o mapa de **todas** as chaves `sgfo.*` (clone entre `localhost` e produção, por domínio o storage é distinto).

---

## 6. Persistência (`localStorage`)

Chaves conhecidas (não exaustivo se forem adicionadas futuras chaves `sgfo.*`):

| Chave                     | Módulo   | Conteúdo (conceitual) |
|---------------------------|----------|------------------------|
| `sgfo.costs.projects.v1`  | Custos   | `{ projects, activeProjectId }` + projetos com `budget`, `entries`, `status`, `closedAt` |
| `sgfo.people.v1`         | Pessoas  | `Person[]` JSON        |
| `sgfo.people.importOnboarding` / `sgfo.people.lastImportAt` | Pessoas | Flags de fluxo de import |
| `sgfo.backlog.items.v1`  | Backlog  | Itens (array)          |

**Migração:** `lib/costs/storage.ts` migra uma vez de `sgfo.costs.budget.v1` + `sgfo.costs.entries.v1` para o formato de projetos.

**Limitação:** apagar dados do browser ou outro dispositivo não sincroniza automaticamente; o backup JSON é o mecanismo oficial de cópia entre hosts.

---

## 7. Importações (Excel / XLSX)

### 7.1 Pessoas (`/people/import`)

- Formato: `.xlsx` / `.xlsm` (via `xlsx`).  
- Entrada desejada: aba / região **BD** mapeada em `bdImport.ts` (cabeçalhos normalizados, campos alinhados ao tipo `Person`).

### 7.2 Custos — orçamento (`xlsxImport.ts`)

- Tenta parsing estruturado (ex.: aba tipo **“VISAO GERENCIAL”**) com totais e quebra por categoria.  
- *Fallback* genérico: varredura por palavras-chave de total e categorias.  
- Opções de coluna (ex. **Orçamento Zig** vs **Orçamento Cliente Aprovado**) quando o ficheiro expõe ambas.  
- O resultado alimenta o orçamento do **projeto** (upsert por `makeProjectId`).

---

## 8. Construção e execução local

```bash
npm install
npm run dev     # http://localhost:3000
npm run build  # build de produção
npm run start  # após build
npm run lint   # ESLint
```

---

## 9. Deploy (Vercel)

- O projeto compila com `next build` (Turbopack no dev, build otimizado na Vercel).  
- Variáveis de ambiente: hoje o núcleo não depende de `NEXT_PUBLIC_*` para dados de negócio.  
- **Código e dados:** o código vem do deploy; os **dados** em produção vivem no `localStorage` de cada utilizador no domínio. Para “espelhar” o ambiente local, usar **Exportar / Importar** na Dashboard ou repetir importações.  
- Repositório Git: recomenda-se remoto (GitHub) + branch alvo conectada ao projeto Vercel para evitar desvio entre o que se edita e o que sobe.

---

## 10. Extensão futura (sugestões técnicas)

- **API + base de dados** (Postgres, etc.): extrair de `lib/*/storage.ts` para camada de repositório.  
- **Autenticação e multi-tenant** se o produto crescer além de uso single-user por browser.  
- **Testes:** Playwright já consta no `devDependencies` — e2e sobre fluxos críticos (import, custos).  
- **CI:** `lint` + `build` em PR.

---

## 11. Ficheiros de configuração relevantes

- `next.config.ts` — configuração Next  
- `tsconfig.json` — TypeScript, paths (`@/`)  
- `eslint.config.mjs`  
- `postcss.config.mjs` / `tailwind` — estilo  
- `.gitignore` — exclui `.next/`, `node_modules/`, `.vercel/`, etc.

---

## 12. Glossário rápido (domínio)

| Termo        | Significado no sistema |
|-------------|-------------------------|
| Previsto   | Teto de orçamento (campo `budget.total` e quebras por categoria) |
| Realizado  | Soma de lançamentos (`CostEntry.amount`) do projeto ativo |
| Bolsão     | Consolidação de sobras/estouro somando projetos **encerrados** |
| Projeto    | Unidade de orçamento + lançamentos; chave alinhada ao evento/contrato |

---

*Documento alinhado ao repositório na data de geração; ajustar aqui se forem adicionados módulos, chaves de storage ou integrações externas.*
