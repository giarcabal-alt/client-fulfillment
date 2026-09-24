"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/(shell)/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Greeting } from "./greeting";
import { SidebarNav } from "./sidebar-nav";
import { Wordmark } from "./wordmark";

// Below `md`, the always-visible sidebar (layout.tsx) is hidden in favor of
// this compact top bar + slide-out Sheet, so the shell doesn't eat most of
// a phone-width viewport with fixed-width nav.
export function MobileNav({
  isAdmin = false,
  displayName = null,
}: {
  isAdmin?: boolean;
  displayName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Base UI's Sheet doesn't auto-close when a link inside it navigates
  // (there's no SheetClose wrapping each nav item) — close it whenever the
  // route changes. Adjusted during render (React's recommended pattern for
  // resetting state on a prop-like change) rather than in an effect, which
  // would cause an extra render pass for the same result.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
      <Link
        href="/talent-acquisition/board"
        className="flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-work-blue text-[10px] font-bold text-white">
          us.
        </span>
        <span className="font-display text-sm text-sidebar-foreground">
          Client Fulfillment App
        </span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Menu />
            </Button>
          }
        />
        <SheetContent
          side="left"
          className="flex flex-col bg-sidebar p-4 text-sidebar-foreground"
        >
          <div className="shrink-0">
            <SheetHeader className="p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
            </SheetHeader>
            <Wordmark />
          </div>
          {/* Same split as the desktop `<aside>` in layout.tsx: only the
              nav list scrolls if it outgrows a short viewport, so
              sign-out below it can never become unreachable. The Sheet
              itself is already `fixed`/viewport-height (sheet.tsx), so
              it doesn't scroll away with the page the way the old
              non-sticky `<aside>` did — this only guards against the nav
              list's own content overflowing the Sheet's fixed height. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav isAdmin={isAdmin} />
          </div>
          <div className="shrink-0">
            <Greeting displayName={displayName} />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md text-sm text-sidebar-foreground/70 outline-none hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Sign out
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
