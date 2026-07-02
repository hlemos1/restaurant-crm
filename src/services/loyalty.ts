import { db } from "@/db";
import { loyaltyPrograms, loyaltyBalances, loyaltyTransactions, customers } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { ProgramCreateInput, ProgramUpdateInput } from "@/lib/validations/loyalty";

export async function getProgram(tenantId: string) {
  const result = await db
    .select()
    .from(loyaltyPrograms)
    .where(and(eq(loyaltyPrograms.tenantId, tenantId), eq(loyaltyPrograms.active, true)))
    .limit(1);
  return result[0] ?? null;
}

export async function createProgram(tenantId: string, data: ProgramCreateInput) {
  const result = await db
    .insert(loyaltyPrograms)
    .values({
      tenantId,
      name: data.name,
      type: data.type,
      rules: data.rules,
      active: true,
    })
    .returning();
  return result[0];
}

export async function updateProgram(tenantId: string, id: number, data: ProgramUpdateInput) {
  const result = await db
    .update(loyaltyPrograms)
    .set(data)
    .where(and(eq(loyaltyPrograms.tenantId, tenantId), eq(loyaltyPrograms.id, id)))
    .returning();
  return result[0] ?? null;
}

export async function getBalance(tenantId: string, customerId: number) {
  const result = await db
    .select()
    .from(loyaltyBalances)
    .where(and(eq(loyaltyBalances.tenantId, tenantId), eq(loyaltyBalances.customerId, customerId)))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllBalances(
  tenantId: string,
  pagination?: { limit: number; offset: number }
) {
  const query = db
    .select({
      id: loyaltyBalances.id,
      customerId: loyaltyBalances.customerId,
      customerName: customers.name,
      points: loyaltyBalances.points,
      tier: loyaltyBalances.tier,
      updatedAt: loyaltyBalances.updatedAt,
    })
    .from(loyaltyBalances)
    .innerJoin(customers, eq(loyaltyBalances.customerId, customers.id))
    .where(eq(loyaltyBalances.tenantId, tenantId))
    .orderBy(desc(loyaltyBalances.points));
  if (pagination) {
    return query.limit(pagination.limit).offset(pagination.offset);
  }
  return query;
}

export async function countBalances(tenantId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(loyaltyBalances)
    .innerJoin(customers, eq(loyaltyBalances.customerId, customers.id))
    .where(eq(loyaltyBalances.tenantId, tenantId));
  return Number(result[0]?.count ?? 0);
}

export async function earnPoints(
  tenantId: string,
  customerId: number,
  points: number,
  description?: string,
  orderId?: number
) {
  const program = await getProgram(tenantId);
  if (!program) throw new Error("Nenhum programa de fidelidade ativo");

  // Upsert balance
  const existing = await getBalance(tenantId, customerId);
  if (existing) {
    await db
      .update(loyaltyBalances)
      .set({
        points: sql`${loyaltyBalances.points} + ${points}`,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyBalances.id, existing.id));
  } else {
    await db.insert(loyaltyBalances).values({
      tenantId,
      customerId,
      programId: program.id,
      points,
    });
  }

  // Record transaction
  const tx = await db
    .insert(loyaltyTransactions)
    .values({
      tenantId,
      customerId,
      programId: program.id,
      type: "earn",
      points,
      orderId: orderId ?? null,
      description: description ?? "Pontos adicionados",
    })
    .returning();

  return tx[0];
}

export async function redeemPoints(
  tenantId: string,
  customerId: number,
  points: number,
  description?: string
) {
  const program = await getProgram(tenantId);
  if (!program) throw new Error("Nenhum programa de fidelidade ativo");

  const balance = await getBalance(tenantId, customerId);
  if (!balance || (balance.points ?? 0) < points) {
    throw new Error("Saldo insuficiente");
  }

  await db
    .update(loyaltyBalances)
    .set({
      points: sql`${loyaltyBalances.points} - ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(loyaltyBalances.id, balance.id));

  const tx = await db
    .insert(loyaltyTransactions)
    .values({
      tenantId,
      customerId,
      programId: program.id,
      type: "redeem",
      points,
      description: description ?? "Pontos resgatados",
    })
    .returning();

  return tx[0];
}

export async function getTransactions(tenantId: string, customerId: number, limit = 20) {
  return db
    .select()
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.tenantId, tenantId),
        eq(loyaltyTransactions.customerId, customerId)
      )
    )
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit);
}
