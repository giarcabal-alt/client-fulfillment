import Link from "next/link";

export default function BoardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl">Talent Acquisition Desk</h1>
      <p className="mt-2 text-muted-foreground">
        The candidate pipeline board lands here in a future prompt. Manage{" "}
        <Link href="/talent-acquisition/roles" className="text-work-blue underline">
          roles
        </Link>{" "}
        in the meantime.
      </p>
    </div>
  );
}
