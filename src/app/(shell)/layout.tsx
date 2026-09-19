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
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div>
          <Wordmark />
          <Greeting displayName={displayName} />
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
      </aside>
      <MobileNav isAdmin={isAdmin} displayName={displayName} />
      <main className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}
