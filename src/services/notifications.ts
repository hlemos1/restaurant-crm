import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, isNull, or, desc, sql } from "drizzle-orm";

interface CreateNotificationData {
  userId?: string | null;
  title: string;
  message: string;
  type: string;
  link?: string;
}

export async function getNotifications(
  tenantId: string,
  userId: string,
  pagination?: { limit: number; offset: number }
) {
  const query = db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        or(eq(notifications.userId, userId), isNull(notifications.userId))
      )
    )
    .orderBy(desc(notifications.createdAt));
  if (pagination) {
    return query.limit(pagination.limit).offset(pagination.offset);
  }
  return query;
}

export async function countNotifications(tenantId: string, userId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        or(eq(notifications.userId, userId), isNull(notifications.userId))
      )
    );
  return Number(result[0]?.count ?? 0);
}

export async function getUnreadCount(tenantId: string, userId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      sql`${notifications.tenantId} = ${tenantId} AND (${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL) AND ${notifications.read} = false`
    );
  return Number(result[0]?.count ?? 0);
}

export async function markAsRead(tenantId: string, id: number) {
  return db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.id, id)));
}

export async function markAllAsRead(tenantId: string, userId: string) {
  return db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        or(eq(notifications.userId, userId), isNull(notifications.userId))
      )
    );
}

export async function createNotification(tenantId: string, data: CreateNotificationData) {
  const result = await db
    .insert(notifications)
    .values({
      tenantId,
      userId: data.userId ?? null,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link ?? null,
    })
    .returning();
  return result[0];
}
