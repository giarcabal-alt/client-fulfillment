import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The compact single-card-with-internal-dividers pattern from
 * DESIGN_SYSTEM.md's Density rules, used instead of stacking a new
 * bordered card per subsection of the same record. A `Section` is a flat,
 * Stone-bordered container with a small semibold heading (13-14px, not
 * the large display weight reserved for page titles) and tighter padding
 * than this app's original card default; group related content inside one
 * `Section` and separate its parts with a `SectionDivider` rather than
 * reaching for a second `Card`.
 */
export function Section({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card py-3 text-sm text-card-foreground",
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 px-4">
          <h2 className="font-display text-[13px] font-semibold text-ink-navy">
            {title}
          </h2>
          {action}
        </div>
      )}
      <div className={cn("px-4", bodyClassName)}>{children}</div>
    </section>
  )
}

/** A 1px Stone divider between logical groups inside one `Section`,
 * instead of a border around a second card. */
export function SectionDivider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-stone", className)} aria-hidden="true" />
}
