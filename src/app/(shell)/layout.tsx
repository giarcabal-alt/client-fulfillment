import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import { Greeting } from "@/components/shell/greeting";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Wordmark } from "@/components/shell/wordmark";
import { signOut } from "./actions";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetched here (server-side) rather than inside SidebarNav/MobileNav so
  // the "Admin" link's visibility is decided once, server-side, from a
  // real getUserRole() check — not duplicated client-side logic that could
  // drift from the actual authorization check every admin action already
  // makes independently. This only controls whether the link is *shown*;
  // it is not itself the authorization boundary (see /admin/page.tsx and
  // src/lib/admin-actions.ts, which each re-check role themselves).
  const role = await getUserRole();
  const isAdmin = role === "admin";

  // Own display_name, not the org name — the sidebar previously only ever
  // showed "upscalesupport" (the org wordmark) and the static app title,
  // with no per-user identity visible anywhere in the shell.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = (profileRow?.display_name as string | null) ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* `sticky top-0 h-dvh` pins the sidebar to the viewport regardless
          of how tall the main content column gets — without an explicit
          height here, the flex row's default `align-items: stretch`
          would otherwise stretch this to match main's full (scrollable)
          content height, defeating `sticky` entirely. This is also what
          was behind the "sidebar background stops partway down" bug:
          the aside's painted height was tied to page content height, not
          the viewport, so a short page left a visible gap below it.
          `h-dvh` (not `h-screen`) so it also matches mobile browser UI
          chrome resizing correctly, matching MobileNav's own treatment. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar p-3 text-sidebar-foreground md:flex">
        <Wordmark />
        {/* Only the nav list itself scrolls if it ever outgrows the
            viewport — the logo above and greeting/sign-out below always
            stay pinned and reachable. `min-h-0` is required on a flex
            child for `overflow-y-auto` to actually kick in instead of
            the item just growing past its flex basis. */}
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
      </aside>
      <MobileNav isAdmin={isAdmin} displayName={displayName} />
      <main className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}
