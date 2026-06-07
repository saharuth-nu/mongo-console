import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone build (outputs a single node server.js)
  output: "standalone",
};

export default nextConfig;
