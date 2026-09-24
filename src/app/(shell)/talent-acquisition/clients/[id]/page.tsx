import { redirect } from "next/navigation";

// The standalone client detail page is gone — every client's full
// record (including linked roles and notes) now renders inline on the
// /talent-acquisition/clients list itself (see clients/page.tsx), so an
// old bookmarked or linked /clients/[id] URL just lands back on the
// list instead of 404ing.
export default function ClientDetailRedirect() {
  redirect("/talent-acquisition/clients");
}
