import { NextRequest, NextResponse } from "next/server";

import {
  createRateLimiter,
  DistributedRateLimiter,
  RateLimitError,
  RateLimitUnavailableError,
} from "./rate-limit";

interface RateLimitWrapperOptions {
  limit?: number;
  interval?: number;
  uniqueTokenPerInterval?: number;
  /** Prefixo das chaves no Redis. Default: "api". */
  prefix?: string;
}

type ApiHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse> | NextResponse;

function extractIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Wrapper que aplica rate limit (Upstash, fail-closed em prod) antes do handler.
 * Extrai IP do request como token de identificacao.
 *
 * Uso:
 *   export const GET = withRateLimit(async (req) => { ... });
 *   export const POST = withRateLimit(handler, { limit: 10 });
 */
export function withRateLimit(handler: ApiHandler, options?: RateLimitWrapperOptions): ApiHandler {
  const interval = options?.interval ?? 60_000;

  const limiter: DistributedRateLimiter = createRateLimiter({
    limit: options?.limit ?? 60,
    interval,
    prefix: options?.prefix ?? "api",
    uniqueTokenPerInterval: options?.uniqueTokenPerInterval ?? 500,
  });

  return async (request: NextRequest, context?: unknown) => {
    const ip = extractIp(request);

    try {
      await limiter.check(ip);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          {
            success: false,
            error: "Limite de requisições excedido. Tente novamente em breve.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(interval / 1000)),
            },
          }
        );
      }
      if (error instanceof RateLimitUnavailableError) {
        return NextResponse.json(
          {
            success: false,
            error: "Serviço temporariamente indisponível. Tente novamente.",
          },
          { status: 503, headers: { "Retry-After": "30" } }
        );
      }
      throw error;
    }

    return handler(request, context);
  };
}
