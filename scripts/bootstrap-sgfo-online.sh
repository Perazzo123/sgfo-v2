#!/usr/bin/env bash
#
# Coloca o SGFO no ar: repositório GitHub (opcional via API) + link Vercel + deploy produção.
#
# Pré-requisitos no teu Mac:
#   - Node/npm (para npx vercel)
#   - Conta GitHub e Vercel
#   - `vercel login` já feito (npx vercel whoami deve funcionar)
#
# Uso típico (repo novo "sgfo" na tua conta):
#   export GITHUB_TOKEN="ghp_xxxx"   # PAT: scope "repo" (classic) ou Fine-grained com Contents RW
#   export GITHUB_OWNER="Perazzo123"
#   export SGFO_REPO_NAME="sgfo"
#   export VERCEL_SCOPE="perazzos-projects"   # slug do team na Vercel (ajusta se for outro)
#   ./scripts/bootstrap-sgfo-online.sh
#
# Sem GITHUB_TOKEN: o script só imprime o link para criares o repo à mão e continua com remote + push.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GITHUB_OWNER="${GITHUB_OWNER:-Perazzo123}"
SGFO_REPO_NAME="${SGFO_REPO_NAME:-sgfo}"
VERCEL_SCOPE="${VERCEL_SCOPE:-perazzos-projects}"
HTTPS_URL="https://github.com/${GITHUB_OWNER}/${SGFO_REPO_NAME}.git"

die() { echo "Erro: $*" >&2; exit 1; }

command -v curl >/dev/null || die "instala curl"
command -v git >/dev/null || die "instala git"

echo "== Raiz do projecto: $ROOT"
echo "== Repo alvo: ${GITHUB_OWNER}/${SGFO_REPO_NAME}"

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "== A criar repositório no GitHub (se ainda não existir)…"
  RESP="$(curl -sS -w "\n%{http_code}" -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    "https://api.github.com/user/repos" \
    -d "{\"name\":\"${SGFO_REPO_NAME}\",\"description\":\"SGFO\",\"private\":true,\"auto_init\":false}")"
  HTTP_CODE="$(echo "$RESP" | tail -n1)"
  BODY="$(echo "$RESP" | sed '$d')"
  if [[ "$HTTP_CODE" == "201" ]]; then
    echo "   Repositório criado."
  elif [[ "$HTTP_CODE" == "422" ]] && echo "$BODY" | grep -qi "already exists"; then
    echo "   Repositório já existia — a continuar."
  else
    echo "$BODY" >&2
    die "GitHub API falhou (HTTP $HTTP_CODE). Confirma o token e o nome do repo."
  fi
else
  echo "== Sem GITHUB_TOKEN — cria o repo manualmente (vazio, sem README):"
  echo "   https://github.com/new  (nome: ${SGFO_REPO_NAME}, owner: ${GITHUB_OWNER})"
  if [[ -t 0 ]]; then
    read -r -p "Carrega Enter quando o repositório existir no GitHub… "
  else
    die "Sem TTY: exporta GITHUB_TOKEN ou cria o repo e corre o script de novo."
  fi
fi

echo "== A configurar remote origin → ${HTTPS_URL}"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$HTTPS_URL"
else
  git remote add origin "$HTTPS_URL"
fi

echo "== A enviar branch main para o GitHub…"
if ! git push -u origin main; then
  die "git push falhou. Cria o repo no GitHub, confirma HTTPS/PAT ou SSH, e volta a correr este script."
fi

echo "== A ligar à Vercel (novo link local; projecto '${SGFO_REPO_NAME}' no scope '${VERCEL_SCOPE}')…"
rm -rf .vercel
npx -y vercel@latest link --yes --project "$SGFO_REPO_NAME" --scope "$VERCEL_SCOPE"

echo "== Deploy produção…"
npx -y vercel@latest --prod --yes

echo ""
echo "== Feito. Próximos passos no painel Vercel:"
echo "   1. Settings → Git → Connect Repository → escolhe ${GITHUB_OWNER}/${SGFO_REPO_NAME}"
echo "      (para deploys automáticos a cada push na main)."
echo "   2. Settings → Environment Variables → copia as METABASE_* (e outras) do projecto antigo se precisares."
echo "   3. Domínios: Settings → Domains (se quiseres um domínio próprio além do *.vercel.app)."
