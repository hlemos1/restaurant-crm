import { db } from "@/db";
import { customers } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { CustomerInput, CustomerUpdateInput } from "@/lib/validations/customer";

export async function getAllCustomers(
  tenantId: string,
  pagination?: { limit: number; offset: number }
) {
  const query = db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), isNull(customers.deletedAt)))
    .orderBy(customers.createdAt);
  if (pagination) {
    return query.limit(pagination.limit).offset(pagination.offset);
  }
  return query;
}

export async function countCustomers(tenantId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), isNull(customers.deletedAt)));
  return Number(result[0]?.count ?? 0);
}

export async function getCustomerById(tenantId: string, id: number) {
  const result = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
    .limit(1);
  return result[0] ?? null;
}

export async function createCustomer(tenantId: string, data: CustomerInput) {
  const result = await db
    .insert(customers)
    .values({
      tenantId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      tags: data.tags,
      lastVisit: new Date().toISOString().split("T")[0],
    })
    .returning();
  return result[0];
}

export async function updateCustomer(tenantId: string, data: CustomerUpdateInput) {
  const result = await db
    .update(customers)
    .set({
      name: data.name,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      tags: data.tags,
    })
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, data.id)))
    .returning();
  return result[0];
}

export async function softDeleteCustomer(tenantId: string, id: number) {
  await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));
}
