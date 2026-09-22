import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background p-6">
      <Card size="sm" className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-base text-ink-navy">
            Sign in
          </CardTitle>
          <CardDescription className="text-sm">
            Client Fulfillment App is invite-only. Contact us if you need
            access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
