// Text-based stand-in for the UpScaleSupport digital lowercase wordmark
// (DESIGN_SYSTEM.md §5) — no logo SVG/PNG asset exists in the repo yet.
// Swap this for the real wordmark asset once one is provided; see
// docs/PROJECT_STATE.md open items.
export function Wordmark() {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-work-blue text-[10px] font-bold text-white">
        us.
      </span>
      <span className="font-display text-sm lowercase tracking-wide text-sidebar-foreground/70">
        upscalesupport
      </span>
    </div>
  );
}
