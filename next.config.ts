import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Attachment uploads go through server actions (10 MB cap enforced in src/server/storage).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
