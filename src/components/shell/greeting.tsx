"use client";

import { useState } from "react";

// Picked client-side so it's genuinely random per page load (a server
// component would get cached/reused across client-side navigations within
// the same layout segment, giving a greeting that's fixed for the whole
// session instead of "each page load"). useState's lazy initializer runs
// once per mount, but SSR runs it too — with a different Math.random()
// result than the client's — so server and client markup legitimately
// differ here. That's expected for client-only randomness (same class of
// case as rendering a timestamp), not a bug: suppressHydrationWarning on
// the text node tells React not to flag or "fix" the intentional
// mismatch, rather than forcing this into an effect-based two-render
// workaround for cosmetic text.
const GREETINGS = [
  "What's up",
  "Aloha",
  "Hola",
  "Mabuhay",
  "Kumusta",
  "Good night",
  "Magandang gabi",
  "Buon giorno",
];

export function Greeting({ displayName }: { displayName: string | null }) {
  const [greeting] = useState(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  );

  return (
    <p className="mb-6 text-sm text-sidebar-foreground">
      <span className="text-sidebar-foreground/60" suppressHydrationWarning>
        {greeting},
      </span>{" "}
      <span className="font-medium">{displayName ?? "there"}</span>
    </p>
  );
}
