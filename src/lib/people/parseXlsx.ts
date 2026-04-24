/**
 * A importação lê somente a aba **BD** (`parseBdWorkbook` em `bdImport.ts`).
 * Aliases legados: `parseFirstSheetXlsx` / `XlsxImportParseResult`.
 */
export { parseBdWorkbook, parseBdWorkbook as parseFirstSheetXlsx, BD_SHEET_ID } from "./bdImport";
export type { BdImportResult, BdRowOutcome, BdImportStats } from "./bdImport";
export type { BdImportResult as XlsxImportParseResult } from "./bdImport";
