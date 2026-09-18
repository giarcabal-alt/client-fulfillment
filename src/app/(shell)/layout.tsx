import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-64 shrink-0 flex-col justify-between bg-sidebar p-4 text-sidebar-foreground">
        <div>
          <Wordmark />
          <div className="mb-6 font-display text-lg">Client Fulfillment App</div>
          <SidebarNav />
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
      <main className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}
