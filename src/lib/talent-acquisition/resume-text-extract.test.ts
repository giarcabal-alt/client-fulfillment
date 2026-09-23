import { describe, expect, it } from "vitest";
import {
  extractTextFromRawPdfBytes,
  looksLikePlausibleResumeText,
} from "./resume-text-extract";

describe("looksLikePlausibleResumeText", () => {
  it("rejects text shorter than the minimum length", () => {
    expect(looksLikePlausibleResumeText("Andrea Villanueva")).toBe(false);
  });

  it("rejects long text that's mostly non-letters (noise from a garbled extraction)", () => {
    const noise = "1 2 3 !@# 456 %^& 789 " + "_".repeat(60);
    expect(looksLikePlausibleResumeText(noise)).toBe(false);
  });

  it("accepts long, mostly-alphabetic text resembling real prose", () => {
    const prose =
      "Andrea Villanueva Software Engineer with experience in TypeScript Python and Node.js";
    expect(looksLikePlausibleResumeText(prose)).toBe(true);
  });
});

describe("extractTextFromRawPdfBytes", () => {
  it("extracts and cleans text found inside BT...ET operator blocks", () => {
    const buffer = Buffer.from(
      "%PDF-1.4\n...garbage...\nBT\n/F1 12 Tf\n(Andrea Villanueva) Tj\nET\n...more garbage...",
      "latin1"
    );
    expect(extractTextFromRawPdfBytes(buffer)).toContain("Andrea Villanueva");
  });

  it("returns an empty string when the buffer has no BT...ET blocks (e.g. a fully compressed content stream)", () => {
    const buffer = Buffer.from("%PDF-1.4\nno text operators here at all", "latin1");
    expect(extractTextFromRawPdfBytes(buffer)).toBe("");
  });
});
