import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// Reached only from /auth/confirm when verifyOtp() fails — an expired,
// already-used, or tampered-with invite/recovery link. Distinct from
// /login so the failure is legible ("this link no longer works") instead
// of looking like a silent redirect to nowhere, which is what happened
// before this page existed.
export default function AuthErrorPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>This link no longer works</CardTitle>
          <CardDescription>
            It may have expired or already been used. Ask whoever invited
            you to send a new one, or sign in below if you already have a
            password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
