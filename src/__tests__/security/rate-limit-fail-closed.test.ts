import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Semantica do rate limiter distribuido (createRateLimiter):
 *
 * 1. Producao SEM Upstash configurado → fail-closed (RateLimitUnavailableError / 503).
 * 2. Dev/test SEM Upstash → fallback in-memory (429 ao exceder limite).
 * 3. Upstash configurado → usa @upstash/ratelimit (429 quando success=false).
 * 4. Upstash configurado mas inacessivel (erro de rede) → fail-open com log.
 */

const { limitMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = vi.fn(() => "sliding-window");
    limit = limitMock;
  }
  return { Ratelimit };
});

import {
  createRateLimiter,
  RateLimitError,
  RateLimitUnavailableError,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

function freshLimiter(overrides?: Partial<Parameters<typeof createRateLimiter>[0]>) {
  return createRateLimiter({
    limit: 2,
    interval: 60_000,
    prefix: "test",
    uniqueTokenPerInterval: 10,
    ...overrides,
  });
}

beforeEach(() => {
  limitMock.mockReset();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createRateLimiter — fail-closed em producao", () => {
  it("lanca RateLimitUnavailableError (503) em producao sem envs Upstash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    const limiter = freshLimiter();

    await expect(limiter.check("ip-1")).rejects.toThrow(RateLimitUnavailableError);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("fail-closed");
  });

  it("RateLimitUnavailableError tem status 503", () => {
    const error = new RateLimitUnavailableError();
    expect(error.status).toBe(503);
    expect(error.name).toBe("RateLimitUnavailableError");
    expect(error).toBeInstanceOf(Error);
  });

  it("nunca e no-op silencioso: em producao sem Upstash, TODA chamada falha", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(logger, "error").mockImplementation(() => {});

    const limiter = freshLimiter();

    for (let i = 0; i < 3; i++) {
      await expect(limiter.check(`ip-${i}`)).rejects.toThrow(RateLimitUnavailableError);
    }
  });
});

describe("createRateLimiter — fallback in-memory em dev", () => {
  it("fora de producao sem Upstash, aplica limite in-memory (429)", async () => {
    // NODE_ENV=test no vitest — cai no fallback dev
    const limiter = freshLimiter({ limit: 2 });

    await expect(limiter.check("dev-ip")).resolves.toBeUndefined();
    await expect(limiter.check("dev-ip")).resolves.toBeUndefined();
    await expect(limiter.check("dev-ip")).rejects.toThrow(RateLimitError);
  });

  it("tokens diferentes nao interferem no fallback dev", async () => {
    const limiter = freshLimiter({ limit: 1 });

    await expect(limiter.check("dev-a")).resolves.toBeUndefined();
    await expect(limiter.check("dev-a")).rejects.toThrow(RateLimitError);
    await expect(limiter.check("dev-b")).resolves.toBeUndefined();
  });
});

describe("createRateLimiter — Upstash configurado", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
  });

  it("permite request quando Upstash retorna success=true", async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 1 });
    const limiter = freshLimiter();

    await expect(limiter.check("ip-ok")).resolves.toBeUndefined();
    expect(limitMock).toHaveBeenCalledWith("ip-ok");
  });

  it("lanca RateLimitError (429) quando Upstash retorna success=false", async () => {
    limitMock.mockResolvedValue({ success: false, remaining: 0 });
    const limiter = freshLimiter();

    await expect(limiter.check("ip-blocked")).rejects.toThrow(RateLimitError);
  });

  it("usa Upstash mesmo em producao (sem fail-closed) quando envs presentes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    limitMock.mockResolvedValue({ success: true, remaining: 5 });
    const limiter = freshLimiter();

    await expect(limiter.check("prod-ip")).resolves.toBeUndefined();
  });

  it("fail-open com log quando Redis esta inacessivel (erro transiente)", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    limitMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const limiter = freshLimiter();

    await expect(limiter.check("ip-net-fail")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("fail-open");
  });
});
