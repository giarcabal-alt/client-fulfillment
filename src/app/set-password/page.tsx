import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reachable only via a verified invite/recovery link (/auth/confirm),
  // which establishes this session — never show the form to someone who
  // just typed the URL without ever clicking a real link.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            Welcome to Client Fulfillment App. Choose a password to finish
            setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
