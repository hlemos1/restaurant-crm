import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-utils";
import { parsePaginationParams } from "@/lib/validations/pagination";
import {
  getNotifications,
  countNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
} from "@/services/notifications";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Não autorizado", 401);

    const tenantId = session.user.tenantId;
    if (!tenantId) return errorResponse("No tenant", 400);

    const userId = session.user.id!;

    // Sem page/limit: lista completa (compat). Com params: pagina + meta.
    const pagination = parsePaginationParams(req.nextUrl.searchParams);
    if (!pagination) {
      const [notificationList, unreadCount] = await Promise.all([
        getNotifications(tenantId, userId),
        getUnreadCount(tenantId, userId),
      ]);
      return successResponse({ notifications: notificationList, unreadCount });
    }

    const [notificationList, unreadCount, total] = await Promise.all([
      getNotifications(tenantId, userId, pagination),
      getUnreadCount(tenantId, userId),
      countNotifications(tenantId, userId),
    ]);
    return successResponse({
      notifications: notificationList,
      unreadCount,
      pagination: { page: pagination.page, limit: pagination.limit, total },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Não autorizado", 401);

    const tenantId = session.user.tenantId;
    if (!tenantId) return errorResponse("No tenant", 400);

    const role = session.user.role;
    if (role !== "admin") {
      return errorResponse("Sem permissão para criar notificações", 403);
    }

    const body = await req.json();
    const { userId, title, message, type, link } = body as {
      userId?: string;
      title?: string;
      message?: string;
      type?: string;
      link?: string;
    };

    if (!title || !message) {
      return errorResponse("Título e mensagem são obrigatórios");
    }

    const notification = await createNotification(tenantId, {
      userId: userId ?? null,
      title,
      message,
      type: type || "info",
      link,
    });

    return successResponse(notification, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Não autorizado", 401);

    const tenantId = session.user.tenantId;
    if (!tenantId) return errorResponse("No tenant", 400);

    const body = await req.json();
    const { id, all } = body as { id?: number; all?: boolean };

    if (all) {
      await markAllAsRead(tenantId, session.user.id!);
      return successResponse({ ok: true });
    }

    if (!id) return errorResponse("ID da notificação é obrigatório");

    await markAsRead(tenantId, id);
    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
