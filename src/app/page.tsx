import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Badge className="w-fit bg-growth-green text-white">Scaffold ready</Badge>
          <CardTitle className="text-2xl">Client Fulfillment App</CardTitle>
          <CardDescription>
            Next.js, Tailwind CSS v4, shadcn/ui, and Supabase are wired up.
            The Talent Acquisition Desk lands here next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Generate suggested message</Button>
        </CardContent>
      </Card>
    </div>
  );
}
