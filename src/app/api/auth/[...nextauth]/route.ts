import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { createRateLimiter, RateLimitError, RateLimitUnavailableError } from "@/lib/rate-limit";

const authLimiter = createRateLimiter({
  limit: 10,
  interval: 60_000,
  prefix: "auth-login",
  uniqueTokenPerInterval: 500,
});

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  // Rate limit only credential login attempts (callback/credentials)
  if (req.nextUrl.pathname.includes("callback/credentials")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    try {
      await authLimiter.check(ip);
    } catch (e) {
      if (e instanceof RateLimitError) {
        return NextResponse.json(
          { error: "Demasiadas tentativas de login. Tente novamente em 1 minuto." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
      if (e instanceof RateLimitUnavailableError) {
        return NextResponse.json(
          { error: "Serviço temporariamente indisponível. Tente novamente." },
          { status: 503, headers: { "Retry-After": "30" } }
        );
      }
      throw e;
    }
  }

  return handlers.POST(req);
}
