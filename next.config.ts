import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads go through server actions: 10 MB per file (src/server/storage), 50 MB per daily report.
    serverActions: { bodySizeLimit: "55mb" },
    // The `radix-ui` umbrella package isn't tree-shaken by default (lucide-react already is).
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
