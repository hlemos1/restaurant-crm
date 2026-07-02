import { db } from "@/db";
import { reservations } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ReservationInput } from "@/lib/validations/reservation";

export async function getAllReservations(
  tenantId: string,
  pagination?: { limit: number; offset: number }
) {
  const query = db
    .select()
    .from(reservations)
    .where(and(eq(reservations.tenantId, tenantId), isNull(reservations.deletedAt)))
    .orderBy(reservations.date);
  if (pagination) {
    return query.limit(pagination.limit).offset(pagination.offset);
  }
  return query;
}

export async function countReservations(tenantId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(reservations)
    .where(and(eq(reservations.tenantId, tenantId), isNull(reservations.deletedAt)));
  return Number(result[0]?.count ?? 0);
}

export async function createReservation(tenantId: string, data: ReservationInput) {
  const result = await db
    .insert(reservations)
    .values({
      tenantId,
      customerId: data.customerId,
      customerName: data.customerName,
      date: data.date,
      time: data.time,
      guests: data.guests,
      tableName: data.table,
      status: data.status,
      notes: data.notes,
    })
    .returning();
  return result[0];
}

export async function updateReservation(tenantId: string, id: number, data: ReservationInput) {
  const result = await db
    .update(reservations)
    .set({
      customerId: data.customerId,
      customerName: data.customerName,
      date: data.date,
      time: data.time,
      guests: data.guests,
      tableName: data.table,
      status: data.status,
      notes: data.notes,
    })
    .where(and(eq(reservations.tenantId, tenantId), eq(reservations.id, id)))
    .returning();
  return result[0];
}

export async function softDeleteReservation(tenantId: string, id: number) {
  await db
    .update(reservations)
    .set({ deletedAt: new Date() })
    .where(and(eq(reservations.tenantId, tenantId), eq(reservations.id, id)));
}
