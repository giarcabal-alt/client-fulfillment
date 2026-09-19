"use client";

import { Menu } from "lucide-react";
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
import { SidebarNav } from "./sidebar-nav";
import { Wordmark } from "./wordmark";

// Below `md`, the always-visible sidebar (layout.tsx) is hidden in favor of
// this compact top bar + slide-out Sheet, so the shell doesn't eat most of
// a phone-width viewport with fixed-width nav.
export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
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
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-work-blue text-[10px] font-bold text-white">
          us.
        </span>
        <span className="font-display text-sm text-sidebar-foreground">
          Client Fulfillment App
        </span>
      </div>
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
          className="flex flex-col justify-between bg-sidebar p-4 text-sidebar-foreground"
        >
          <div>
            <SheetHeader className="p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
            </SheetHeader>
            <Wordmark />
            <div className="mb-6 font-display text-lg">
              Client Fulfillment App
            </div>
            <SidebarNav isAdmin={isAdmin} />
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              Sign out
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </header>
  );
}
