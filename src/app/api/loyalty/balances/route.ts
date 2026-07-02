import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError, paginatedResponse } from "@/lib/api-utils";
import { parsePaginationParams } from "@/lib/validations/pagination";
import { getAllBalances, countBalances } from "@/services/loyalty";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Nao autorizado", 401);

    const tenantId = session.user.tenantId;
    if (!tenantId) return errorResponse("No tenant", 400);

    // Sem page/limit: array completo (compat). Com params: envelope paginado.
    const pagination = parsePaginationParams(req.nextUrl.searchParams);
    if (!pagination) {
      return successResponse(await getAllBalances(tenantId));
    }

    const [data, total] = await Promise.all([
      getAllBalances(tenantId, pagination),
      countBalances(tenantId),
    ]);
    return paginatedResponse(data, { page: pagination.page, limit: pagination.limit, total });
  } catch (error) {
    return handleApiError(error);
  }
}
