// Server-only text extraction from an uploaded resume file. Never import
// this from a client component — pdf-parse/mammoth are Node-only
// libraries with no browser build path used here (ATS_FEATURES.md
// Prerequisites: "same pair used successfully on the 3PL project").
//
// pdf-parse is pinned to the 1.x line deliberately: 2.x rewrote itself
// around pdfjs-dist, which imports browser canvas APIs (DOMMatrix) at
// module evaluation time — that crashes any Node.js server environment
// on import, not just Vercel's, and no workerSrc/Turbopack workaround
// changes that (see docs/PROJECT_STATE.md's pdfjs-dist gotcha). 1.x is a
// pure-JS module with no browser API dependency, which is what
// ATS_FEATURES.md originally approved.

import pdf from "pdf-parse";
import { extractRawText } from "mammoth";

// Mirrors resume-actions.ts's ALLOWED_TYPES — the two file types this app
// accepts for upload are the only two this app ever needs to extract text
// from.
const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function isSupportedResumeType(mimeType: string): boolean {
  return SUPPORTED_TYPES.has(mimeType);
}

// Explicit options for clarity, not because they change behavior: `max: 0`
// and `version: 'default'` are pdf-parse's own defaults already (confirmed
// by reading node_modules/pdf-parse/lib/pdf-parse.js — `version: 'default'`
// literally maps back to the same 'v1.10.100' the default already resolves
// to). Kept explicit so a future reader isn't tempted to add them thinking
// they're missing.
const PDF_PARSE_OPTIONS = { max: 0, version: "default" as const };

// A resume PDF whose cross-reference table has a genuinely bad entry (not
// just an unparseable header — pdf.js's own recovery mode only retries on
// XRefParseException, not on a mismatched object found while walking the
// page tree, confirmed by reading pdf.js's worker source for every version
// pdf-parse bundles) fails inside `PDFJS.getDocument()` itself, before any
// page is ever rendered — no pdf-parse option reaches that code path.
// Last-resort fallback: scan the raw byte stream for BT…ET (BeginText…
// EndText) operator blocks and keep only printable ASCII. This only finds
// anything in a PDF whose content streams aren't Flate/LZW-compressed
// (most modern PDF generators do compress them, so this mostly helps
// simple/old PDF-generator output, not most real resumes) — it cannot
// recover text from a compressed stream or a scanned/image-only PDF at
// all. Guarded by a plausibility check before being trusted: an XRef
// failure on a compressed-stream PDF will make this fallback return
// nothing or noise, and feeding noise into the downstream Anthropic
// structured-extraction call would be worse than today's existing
// graceful "couldn't read details, fill in manually" path — so a result
// that doesn't look like real prose is treated as still-failed, not
// silently accepted.
export function extractTextFromRawPdfBytes(fileBytes: Buffer): string {
  const raw = fileBytes.toString("latin1");
  const blocks = raw.match(/BT[\s\S]*?ET/g) ?? [];
  return blocks
    .map((block) => block.replace(/[^\x20-\x7E\n]/g, " "))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikePlausibleResumeText(text: string): boolean {
  if (text.length < 40) return false;
  const letters = text.match(/[A-Za-z]/g)?.length ?? 0;
  return letters / text.length > 0.5;
}

export async function extractResumeText(
  fileBytes: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const result = await pdf(fileBytes, PDF_PARSE_OPTIONS);
      return result.text;
    } catch (pdfParseError) {
      const fallbackText = extractTextFromRawPdfBytes(fileBytes);
      if (looksLikePlausibleResumeText(fallbackText)) {
        return fallbackText;
      }
      throw pdfParseError;
    }
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await extractRawText({ buffer: fileBytes });
    return result.value;
  }
  throw new Error(`Unsupported resume file type: ${mimeType}`);
}
