import type { NextConfig } from "next";
import { securityHeaders } from "./src/shared/config/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
