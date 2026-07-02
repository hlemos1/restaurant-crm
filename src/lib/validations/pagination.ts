import { z } from "zod";

/**
 * Paginacao padrao dos endpoints de listagem.
 *
 * Compatibilidade: sem `page`/`limit` na query string, as rotas mantem o
 * comportamento antigo (array completo em `data`). Com qualquer um dos
 * params, a rota aplica limit/offset e devolve o envelope
 * `{ success, data, pagination: { page, limit, total } }`.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageRequest {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Retorna null quando nenhum param de paginacao foi enviado (modo compat).
 * Lanca ZodError (422 via handleApiError) para valores invalidos.
 */
export function parsePaginationParams(searchParams: URLSearchParams): PageRequest | null {
  if (!searchParams.has("page") && !searchParams.has("limit")) {
    return null;
  }
  const parsed = paginationQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  return { ...parsed, offset: (parsed.page - 1) * parsed.limit };
}
