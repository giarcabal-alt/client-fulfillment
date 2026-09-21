// Server-only text extraction from an uploaded resume file. Never import
// this from a client component — pdf-parse/mammoth are Node-only
// libraries with no browser build path used here (ATS_FEATURES.md
// Prerequisites: "same pair used successfully on the 3PL project").

import { PDFParse } from "pdf-parse";
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
    const parser = new PDFParse({ data: fileBytes });
    const result = await parser.getText();
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
