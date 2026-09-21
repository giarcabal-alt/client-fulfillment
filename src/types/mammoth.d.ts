// mammoth ships no types of its own and there's no @types/mammoth package
// (confirmed via `npm view @types/mammoth` — 404) — this covers only the
// one function this app actually calls (extractRawText), not the full API.
declare module "mammoth" {
  export function extractRawText(input: {
    buffer: Buffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
