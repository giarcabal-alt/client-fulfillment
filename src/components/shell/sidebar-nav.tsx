"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const activeItem = {
  label: "Talent Acquisition Desk",
  href: "/talent-acquisition/board",
  match: "/talent-acquisition",
};

const comingSoonItems = ["Onboarding", "Kickoff"];

export function SidebarNav() {
  const pathname = usePathname();
  const isActive = pathname.startsWith(activeItem.match);

  return (
    <nav className="flex flex-col gap-1">
      <Link
        href={activeItem.href}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {activeItem.label}
      </Link>
      {comingSoonItems.map((label) => (
        <div
          key={label}
          className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
        >
          <span>{label}</span>
          <span className="text-xs uppercase tracking-wide">Coming soon</span>
        </div>
      ))}
    </nav>
  );
}
