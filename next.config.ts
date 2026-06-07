import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone build (outputs a single node server.js)
  output: "standalone",
  // Serve the app under /db-console when behind a reverse proxy
  // Remove or change this if serving at root (/)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
