import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `pdf-parse` faz `await import(workerSrc)` em runtime. Se o Turbopack bundlar a lib,
   * o worker fica num chunk com path relativo errado. Marcamos como externos para
   * o Node carregar o pacote e o worker direto de `node_modules`.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  /**
   * Em deploy (Vercel), o tracer não detecta o worker do pdfjs porque é importado
   * via string dinâmica em runtime. Forçamos a inclusão para a função serverless.
   * Cobre tanto o caso normal como hoisting (npm pode mover `pdfjs-dist` para a raiz).
   */
  outputFileTracingIncludes: {
    "/api/costs/financial-closing": [
      "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/**",
    ],
  },
};

export default nextConfig;
