import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A single record field, laid out as a small label on the left and a
 * plain-reading value on the right — the "properties list" pattern from
 * DESIGN_SYSTEM.md's Density rules, used instead of a grid of individually
 * bordered inputs. The value itself stays visually plain at rest; editing
 * affordances (a control's border, a select's chevron) are opt-in via
 * `propertyControlClass`/`propertySelectTriggerClass` below and only show
 * up on hover or focus of the row.
 */
export function PropertyRow({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string
  children: React.ReactNode
  className?: string
  /** Override the label column's width — defaults to the standard
   * `w-[9.5rem]` (152px). Pass e.g. `"w-[130px]"` for a page whose panel
   * is narrow enough that the wider default crowds the value column. */
  labelClassName?: string
}) {
  return (
    <div
      className={cn(
        "group/row -mx-2 flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-stone/30 focus-within:bg-stone/30",
        className
      )}
    >
      <span
        className={cn(
          "w-[9.5rem] shrink-0 pt-1 text-xs text-muted-foreground",
          labelClassName
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * Shared class string for the actual editable control inside a
 * PropertyRow (an `Input`, or a `Select`'s trigger) — transparent border/
 * background at rest so it reads as plain text, a Stone border on hover,
 * and this app's standard Work Blue focus-visible ring on focus (never
 * suppressed, even though the row is otherwise chrome-free until
 * interacted with — DESIGN_SYSTEM.md's Density rules require the focus
 * ring stay regardless of hover state). Apply on top of the component's
 * own base classes; `cn` (tailwind-merge-based) resolves the conflicting
 * border/background utilities in this string's favor.
 */
export const propertyControlClass =
  "h-auto w-full min-w-0 truncate border border-transparent bg-transparent px-1.5 py-1 text-sm shadow-none transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * Same idea, for a `SelectTrigger` specifically — its chevron icon is
 * hidden at rest and shown on hover/focus/open of the trigger, since only
 * a Select's value needs the "this is a dropdown" affordance.
 */
export const propertySelectTriggerClass = cn(
  propertyControlClass,
  "justify-between gap-1.5 [&_svg]:opacity-0 hover:[&_svg]:opacity-100 focus-visible:[&_svg]:opacity-100 data-[popup-open]:[&_svg]:opacity-100",
  // The Select primitive's value span is itself `display: flex`, which
  // silences its own `line-clamp-1` (that only renders an ellipsis on a
  // `-webkit-box`/block container) — without this, long values in a
  // narrow PropertyRow just clip mid-character with no "…". Force
  // block-level ellipsis truncation on that inner span specifically.
  "[&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:overflow-hidden [&_[data-slot=select-value]]:text-ellipsis [&_[data-slot=select-value]]:whitespace-nowrap"
)

/** A plain, non-editable value for a PropertyRow that just displays
 * something (a read-only field, a computed value) rather than hosting an
 * editable control. */
export function PropertyValue({
  children,
  muted,
  className,
}: {
  children: React.ReactNode
  muted?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "block truncate px-1.5 py-1 text-sm",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}
