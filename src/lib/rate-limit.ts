import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logger } from "./logger";

/**
 * Rate limiting distribuido via Upstash Redis (@upstash/ratelimit).
 *
 * Semantica por ambiente:
 * - Upstash configurado (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN):
 *   sliding window distribuido — funciona em Vercel serverless multi-instance.
 * - Producao SEM Upstash: fail-closed — toda rota rate-limitada responde 503
 *   (RateLimitUnavailableError) com log de erro. Nunca no-op silencioso.
 * - Dev/test sem Upstash: fallback para o limiter in-memory (Map),
 *   adequado a single-instance local.
 */

interface RateLimitOptions {
  interval: number;
  uniqueTokenPerInterval: number;
}

interface TokenRecord {
  count: number;
  expiresAt: number;
}

export class RateLimitError extends Error {
  status: number;

  constructor(message = "Limite de requisições excedido") {
    super(message);
    this.name = "RateLimitError";
    this.status = 429;
  }
}

export class RateLimitUnavailableError extends Error {
  status: number;

  constructor(message = "Rate limiting indisponível. Tente novamente em instantes.") {
    super(message);
    this.name = "RateLimitUnavailableError";
    this.status = 503;
  }
}

/**
 * Limiter in-memory usando Map.
 * Usado APENAS como fallback de dev/test quando Upstash nao esta configurado.
 * Em producao serverless e inutil (cada invocacao tem memoria propria).
 */
export function rateLimit(options: RateLimitOptions) {
  const { interval, uniqueTokenPerInterval } = options;
  const tokenMap = new Map<string, TokenRecord>();

  // Limpeza periodica — remove tokens expirados
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of tokenMap) {
      if (record.expiresAt <= now) {
        tokenMap.delete(key);
      }
    }
    // Evita que o Map cresca indefinidamente
    if (tokenMap.size > uniqueTokenPerInterval) {
      const excess = tokenMap.size - uniqueTokenPerInterval;
      const keys = tokenMap.keys();
      for (let i = 0; i < excess; i++) {
        const { value } = keys.next();
        if (value) tokenMap.delete(value);
      }
    }
  }, interval);

  // Nao bloqueia o shutdown do processo
  if (cleanup.unref) {
    cleanup.unref();
  }

  return {
    check(limit: number, token: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const now = Date.now();
        const record = tokenMap.get(token);

        if (!record || record.expiresAt <= now) {
          tokenMap.set(token, { count: 1, expiresAt: now + interval });
          return resolve();
        }

        if (record.count >= limit) {
          return reject(new RateLimitError());
        }

        record.count++;
        resolve();
      });
    },
  };
}

export interface DistributedRateLimiterOptions {
  /** Max de requests por janela */
  limit: number;
  /** Janela em ms */
  interval: number;
  /** Prefixo das chaves no Redis (ex: "register", "auth-login", "chat") */
  prefix: string;
  /** Apenas para o fallback in-memory de dev */
  uniqueTokenPerInterval?: number;
}

export interface DistributedRateLimiter {
  /**
   * Lanca RateLimitError (429) se o token excedeu o limite.
   * Lanca RateLimitUnavailableError (503) em producao sem Upstash configurado.
   */
  check(token: string): Promise<void>;
}

function resolveUpstash(opts: DistributedRateLimiterOptions): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(opts.limit, `${Math.ceil(opts.interval / 1000)} s`),
    analytics: true,
    prefix: `crm:${opts.prefix}`,
  });
}

/**
 * Cria um rate limiter distribuido (Upstash) com fail-closed em producao
 * e fallback in-memory em dev/test.
 */
export function createRateLimiter(opts: DistributedRateLimiterOptions): DistributedRateLimiter {
  // undefined = ainda nao resolvido; null = Upstash nao configurado
  let upstash: Ratelimit | null | undefined;
  let memoryFallback: ReturnType<typeof rateLimit> | null = null;

  return {
    async check(token: string): Promise<void> {
      if (upstash === undefined) {
        upstash = resolveUpstash(opts);
      }

      if (upstash) {
        let success: boolean;
        try {
          const result = await upstash.limit(token);
          success = result.success;
        } catch (error) {
          // Redis configurado mas inacessivel (erro transiente de rede):
          // fail-open com log — indisponibilidade de Redis nao derruba login/registro.
          logger.error("[rate-limit] Upstash inacessível — request liberado (fail-open)", {
            prefix: opts.prefix,
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        if (!success) {
          throw new RateLimitError();
        }
        return;
      }

      // Upstash NAO configurado
      if (process.env.NODE_ENV === "production") {
        logger.error(
          "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN ausentes em produção — fail-closed (503)",
          { prefix: opts.prefix }
        );
        throw new RateLimitUnavailableError();
      }

      // Dev/test: fallback in-memory
      if (!memoryFallback) {
        memoryFallback = rateLimit({
          interval: opts.interval,
          uniqueTokenPerInterval: opts.uniqueTokenPerInterval ?? 500,
        });
      }
      return memoryFallback.check(opts.limit, token);
    },
  };
}
