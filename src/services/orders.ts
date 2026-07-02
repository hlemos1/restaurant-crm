import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export async function createOrder(
  tenantId: string,
  data: {
    customerId?: number;
    customerName: string;
    items: unknown;
    total: number;
    status?: string;
    date?: string;
  }
) {
  const result = await db
    .insert(orders)
    .values({
      tenantId,
      customerId: data.customerId ?? null,
      customerName: data.customerName,
      items: data.items,
      total: String(data.total),
      status: data.status || "pending",
      date: data.date || new Date().toISOString().split("T")[0],
    })
    .returning();
  return result[0];
}

export async function getAllOrders(
  tenantId: string,
  pagination?: { limit: number; offset: number }
) {
  const query = db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), isNull(orders.deletedAt)))
    .orderBy(orders.createdAt);
  if (pagination) {
    return query.limit(pagination.limit).offset(pagination.offset);
  }
  return query;
}

export async function countOrders(tenantId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), isNull(orders.deletedAt)));
  return Number(result[0]?.count ?? 0);
}

export async function updateOrderStatus(tenantId: string, id: number, status: string) {
  const result = await db
    .update(orders)
    .set({ status })
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
    .returning();
  return result[0];
}

export async function softDeleteOrder(tenantId: string, id: number) {
  await db
    .update(orders)
    .set({ deletedAt: new Date() })
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)));
}
