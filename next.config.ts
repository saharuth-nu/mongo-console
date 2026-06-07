import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone build (outputs a single node server.js)
  output: "standalone",
  // Serve under a subpath when behind a reverse proxy.
  // Value is baked in at build time via NEXT_PUBLIC_BASE_PATH build arg.
  // Leave empty ("") to serve at root /.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  // Always use trailing slash — avoids redirect loop when behind nginx.
  // nginx proxies /db-console/* as-is; Next.js won't strip the trailing slash.
  trailingSlash: true,
};

export default nextConfig;
