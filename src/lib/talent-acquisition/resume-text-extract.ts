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

export async function extractResumeText(
  fileBytes: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    const result = await pdf(fileBytes);
    return result.text;
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
