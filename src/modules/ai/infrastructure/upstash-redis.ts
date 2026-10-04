import { Redis } from "@upstash/redis";

// `new Redis({ url, token })` verified with Context7. Kept in infrastructure
// so server-api.ts never imports an Upstash package.
export function createUpstashRedis(credentials: {
  url: string;
  token: string;
}): Redis {
  return new Redis(credentials);
}
