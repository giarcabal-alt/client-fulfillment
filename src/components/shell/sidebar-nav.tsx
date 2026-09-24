"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Modules (what you actually do here) stay grouped together, in the order
// they appear across the product — Onboarding/Kickoff included even though
// they're disabled placeholders, since they're still "modules," not
// settings. Settings/Admin are app-level, not a module, so they're a
// visually separate second group below a divider (see the render below).
//
// Talent Acquisition Desk is a parent *label*, not a link — Board (below)
// is its own sub-item pointing at the exact same destination the parent
// used to link to, so keeping the parent clickable too would just be a
// second way to do the same thing. The four sub-items stay permanently
// visible under it rather than behind a collapsible toggle: there are
// only four, this is the only module that has any today, and a toggle
// would add a click to reach navigation that's currently one click away.
const talentAcquisitionSubItems = [
  { label: "Board", href: "/talent-acquisition/board" },
  { label: "Job Openings", href: "/talent-acquisition/roles" },
  { label: "Talent Bench", href: "/talent-acquisition/talent-bench" },
  // Reuses Talent Bench pre-filtered to status='rejected' rather than a
  // second standalone archive page — see talent-bench/page.tsx.
  {
    label: "Rejected",
    href: "/talent-acquisition/talent-bench?status=rejected",
  },
  { label: "Metrics", href: "/talent-acquisition/metrics" },
  { label: "Clients", href: "/talent-acquisition/clients" },
];

const comingSoonItems = ["Onboarding", "Kickoff"];

export function SidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const secondaryItems = isAdmin
    ? [
        { label: "Settings", href: "/settings", match: "/settings" },
        { label: "Admin", href: "/admin", match: "/admin" },
        { label: "How to Use", href: "/help", match: "/help" },
      ]
    : [
        { label: "Settings", href: "/settings", match: "/settings" },
        { label: "How to Use", href: "/help", match: "/help" },
      ];

  function navLink(item: { label: string; href: string; match: string }) {
    const isActive = pathname.startsWith(item.match);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {item.label}
      </Link>
    );
  }

  // Talent Bench and Rejected share the same pathname
  // (/talent-acquisition/talent-bench) and differ only by the
  // `status` query param, so a plain pathname match can't tell them
  // apart the way it can for Board/Job Openings — this checks the query
  // string too, matching each sub-item to exactly the URL it links to.
  const isOnTalentBench = pathname === "/talent-acquisition/talent-bench";
  const isRejectedFilter = searchParams.get("status") === "rejected";

  function talentAcquisitionSubLink(item: { label: string; href: string }) {
    const isActive =
      item.label === "Rejected"
        ? isOnTalentBench && isRejectedFilter
        : item.label === "Talent Bench"
          ? isOnTalentBench && !isRejectedFilter
          : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "rounded-md py-1.5 pr-3 pl-6 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      <span className="px-3 py-2 text-sm font-medium text-sidebar-foreground">
        Talent Acquisition Desk
      </span>
      {talentAcquisitionSubItems.map(talentAcquisitionSubLink)}
      {comingSoonItems.map((label) => (
        <div
          key={label}
          className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
        >
          <span>{label}</span>
          <span className="text-xs uppercase tracking-wide">Coming soon</span>
        </div>
      ))}
      <hr className="my-2 border-t border-stone/20" />
      {secondaryItems.map(navLink)}
    </nav>
  );
}
