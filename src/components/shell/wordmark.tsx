import Link from "next/link";

// Text-based stand-in for the UpScaleSupport digital lowercase wordmark
// (DESIGN_SYSTEM.md §5) — no logo SVG/PNG asset exists in the repo yet.
// Swap this for the real wordmark asset once one is provided; see
// docs/PROJECT_STATE.md open items.
//
// Links to the shell's landing route (the board — there's no separate
// dashboard page) so it behaves like a real clickable logo, not just a
// static label. There's no route at "/" itself (no src/app/page.tsx), so
// this is the closest thing to a "home" this app has.
export function Wordmark() {
  return (
    <Link
      href="/talent-acquisition/board"
      className="mb-6 flex w-fit items-center gap-2 transition-opacity hover:opacity-80"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-work-blue text-[10px] font-bold text-white">
        us.
      </span>
      <span className="font-display text-sm lowercase tracking-wide text-sidebar-foreground/70">
        upscalesupport
      </span>
    </Link>
  );
}
