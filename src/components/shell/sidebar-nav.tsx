"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Modules (what you actually do here) stay grouped together, in the order
// they appear across the product — Onboarding/Kickoff included even though
// they're disabled placeholders, since they're still "modules," not
// settings. Settings/Admin are app-level, not a module, so they're a
// visually separate second group below a divider (see the render below).
const moduleItems = [
  {
    label: "Talent Acquisition Desk",
    href: "/talent-acquisition/board",
    match: "/talent-acquisition",
  },
];

const comingSoonItems = ["Onboarding", "Kickoff"];

export function SidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const secondaryItems = isAdmin
    ? [
        { label: "Settings", href: "/settings", match: "/settings" },
        { label: "Admin", href: "/admin", match: "/admin" },
      ]
    : [{ label: "Settings", href: "/settings", match: "/settings" }];

  function navLink(item: { label: string; href: string; match: string }) {
    const isActive = pathname.startsWith(item.match);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {moduleItems.map(navLink)}
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
