import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sidebar's Sign Out button now sits permanently pinned to the
  // viewport's bottom-left corner (see (shell)/layout.tsx's sticky-sidebar
  // fix) — Next.js's dev-mode route indicator defaults to that exact
  // corner too, and its own click target sat directly on top of Sign
  // Out, making it visually and functionally unreachable in dev (not a
  // production issue: the indicator doesn't render in production
  // builds). Moved out of the way rather than adjusting the sidebar's
  // own layout to dodge a dev-only overlay.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
