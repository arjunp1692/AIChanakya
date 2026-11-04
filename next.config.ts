import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Attachment uploads go through server actions (10 MB cap enforced in src/server/storage).
    serverActions: { bodySizeLimit: "11mb" },
    // The `radix-ui` umbrella package isn't tree-shaken by default (lucide-react already is).
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
