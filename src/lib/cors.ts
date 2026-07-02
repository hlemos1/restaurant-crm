/**
 * Allowlist de origens CORS.
 *
 * - NEXT_PUBLIC_APP_URL configurada: entra na allowlist.
 * - Sem NEXT_PUBLIC_APP_URL fora de producao: fallback http://localhost:3000.
 * - Sem NEXT_PUBLIC_APP_URL EM producao: nenhuma origem adicional
 *   (apenas os dominios fixos) + log de erro. Nunca localhost em prod.
 */

const STATIC_ORIGINS = ["https://redenexial.com", "https://restaurant-crm-iota.vercel.app"];

export function buildAllowedOrigins(env: {
  NEXT_PUBLIC_APP_URL?: string;
  NODE_ENV?: string;
}): string[] {
  const origins = [...STATIC_ORIGINS];

  if (env.NEXT_PUBLIC_APP_URL) {
    origins.unshift(env.NEXT_PUBLIC_APP_URL);
  } else if (env.NODE_ENV !== "production") {
    origins.unshift("http://localhost:3000");
  } else {
    console.error(
      "[cors] NEXT_PUBLIC_APP_URL ausente em produção — nenhuma origem de app adicionada à allowlist CORS"
    );
  }

  return origins;
}
