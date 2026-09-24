import Link from "next/link";
import { TimezoneClock } from "@/lib/talent-acquisition/timezone-clock";

export type ClientListItem = {
  id: string;
  company_name: string;
  point_of_contact_name: string | null;
  timezone: string | null;
  roleCount: number;
};

export function ClientRow({ client }: { client: ClientListItem }) {
  return (
    <Link
      href={`/talent-acquisition/clients/${client.id}`}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 outline-none hover:bg-stone/30 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-ink-navy">{client.company_name}</span>
        <span className="text-xs text-muted-foreground">
          {client.point_of_contact_name ?? "No point of contact set"} ·{" "}
          {client.roleCount} {client.roleCount === 1 ? "role" : "roles"}
        </span>
      </div>
      <TimezoneClock timezone={client.timezone} />
    </Link>
  );
}
