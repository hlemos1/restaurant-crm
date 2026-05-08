/**
 * Service Sinapse — queries com tenant scoping obrigatorio.
 *
 * Convencao: toda funcao recebe `tenantId` como primeiro parametro.
 * Nada de query global. RLS aplicada por convencao de service.
 */

import { eq, and, desc, asc } from "drizzle-orm";

import { db } from "@/db";
import {
  sinapseLayers,
  sinapseNodes,
  sinapseSynapses,
  sinapseEvents,
  sinapseDecisions,
  sinapseDocuments,
  sinapseMaturityAxes,
  sinapseMaturityHistory,
  type DecisionStatus,
  type DocumentType,
  type NodeState,
  type SynapseState,
} from "@/db/schema-sinapse";

// ── REDE NEURAL ────────────────────────────────────────────────

export type NetworkSnapshot = {
  layers: (typeof sinapseLayers.$inferSelect)[];
  nodes: (typeof sinapseNodes.$inferSelect)[];
  synapses: (typeof sinapseSynapses.$inferSelect)[];
};

export async function getNetwork(tenantId: string): Promise<NetworkSnapshot> {
  const [layers, nodes, synapses] = await Promise.all([
    db
      .select()
      .from(sinapseLayers)
      .where(eq(sinapseLayers.tenantId, tenantId))
      .orderBy(asc(sinapseLayers.sortOrder)),
    db
      .select()
      .from(sinapseNodes)
      .where(eq(sinapseNodes.tenantId, tenantId))
      .orderBy(desc(sinapseNodes.weight)),
    db.select().from(sinapseSynapses).where(eq(sinapseSynapses.tenantId, tenantId)),
  ]);
  return { layers, nodes, synapses };
}

export async function getNetworkStats(tenantId: string) {
  const { layers, nodes, synapses } = await getNetwork(tenantId);

  const byNodeState = (state: NodeState) => nodes.filter((n) => n.state === state).length;
  const bySynapseState = (state: SynapseState) => synapses.filter((s) => s.state === state).length;

  return {
    layers: layers.length,
    nodes: nodes.length,
    synapses: synapses.length,
    nodeStates: {
      active: byNodeState("active"),
      dormant: byNodeState("dormant"),
      inflamed: byNodeState("inflamed"),
      isolated: byNodeState("isolated"),
      growing: byNodeState("growing"),
    },
    synapseStates: {
      healthy: bySynapseState("healthy"),
      broken: bySynapseState("broken"),
      under_construction: bySynapseState("under_construction"),
      dormant: bySynapseState("dormant"),
    },
  };
}

// ── DECISOES ───────────────────────────────────────────────────

export async function listDecisions(
  tenantId: string,
  opts?: { status?: DecisionStatus; limit?: number }
) {
  const conditions = [eq(sinapseDecisions.tenantId, tenantId)];
  if (opts?.status) {
    conditions.push(eq(sinapseDecisions.status, opts.status));
  }
  const query = db
    .select()
    .from(sinapseDecisions)
    .where(and(...conditions))
    .orderBy(desc(sinapseDecisions.createdAt));

  return opts?.limit ? query.limit(opts.limit) : query;
}

export async function getDecision(tenantId: string, id: string) {
  const [decision] = await db
    .select()
    .from(sinapseDecisions)
    .where(and(eq(sinapseDecisions.tenantId, tenantId), eq(sinapseDecisions.id, id)))
    .limit(1);
  return decision ?? null;
}

// ── DOCUMENTOS ─────────────────────────────────────────────────

export async function listDocuments(
  tenantId: string,
  opts?: { type?: DocumentType; latestOnly?: boolean }
) {
  const conditions = [eq(sinapseDocuments.tenantId, tenantId)];
  if (opts?.type) {
    conditions.push(eq(sinapseDocuments.type, opts.type));
  }
  if (opts?.latestOnly !== false) {
    conditions.push(eq(sinapseDocuments.isLatest, true));
  }

  return db
    .select()
    .from(sinapseDocuments)
    .where(and(...conditions))
    .orderBy(desc(sinapseDocuments.updatedAt));
}

export async function getDocument(tenantId: string, id: string) {
  const [doc] = await db
    .select()
    .from(sinapseDocuments)
    .where(and(eq(sinapseDocuments.tenantId, tenantId), eq(sinapseDocuments.id, id)))
    .limit(1);
  return doc ?? null;
}

// ── MATURIDADE ─────────────────────────────────────────────────

export async function listMaturityAxes(tenantId: string) {
  return db
    .select()
    .from(sinapseMaturityAxes)
    .where(eq(sinapseMaturityAxes.tenantId, tenantId))
    .orderBy(asc(sinapseMaturityAxes.sortOrder));
}

export async function getMaturityAverage(tenantId: string): Promise<number> {
  const axes = await listMaturityAxes(tenantId);
  if (axes.length === 0) return 0;
  const total = axes.reduce((sum, a) => sum + Number(a.currentScore), 0);
  return Math.round((total / axes.length) * 100) / 100;
}

// ── EVENTOS ────────────────────────────────────────────────────

export async function listRecentEvents(tenantId: string, limit = 20) {
  return db
    .select()
    .from(sinapseEvents)
    .where(eq(sinapseEvents.tenantId, tenantId))
    .orderBy(desc(sinapseEvents.occurredAt))
    .limit(limit);
}

export async function logEvent(input: {
  tenantId: string;
  type: typeof sinapseEvents.$inferInsert.type;
  source?: string;
  actorUserId?: string | null;
  relatedNodeId?: string | null;
  relatedSynapseId?: string | null;
  rawContent?: string;
  payload?: Record<string, unknown>;
}) {
  const [event] = await db
    .insert(sinapseEvents)
    .values({
      tenantId: input.tenantId,
      type: input.type,
      source: input.source ?? "manual",
      actorUserId: input.actorUserId ?? null,
      relatedNodeId: input.relatedNodeId ?? null,
      relatedSynapseId: input.relatedSynapseId ?? null,
      rawContent: input.rawContent,
      payload: input.payload ?? {},
    })
    .returning();
  return event;
}

// ── SINAIS DE ALERTA (cockpit) ─────────────────────────────────

export async function getAlerts(tenantId: string) {
  const { nodes, synapses } = await getNetwork(tenantId);

  const inflamedNodes = nodes.filter((n) => n.state === "inflamed");
  const dormantHighWeight = nodes.filter((n) => n.state === "dormant" && Number(n.weight) >= 7);
  const brokenCriticalSynapses = synapses.filter(
    (s) => s.state === "broken" && Number(s.weight) >= 7
  );

  const overdueDecisions = await db
    .select()
    .from(sinapseDecisions)
    .where(and(eq(sinapseDecisions.tenantId, tenantId), eq(sinapseDecisions.status, "pending")));

  return {
    inflamedNodes,
    dormantHighWeight,
    brokenCriticalSynapses,
    overdueDecisions: overdueDecisions.filter(
      (d) => d.deadline && new Date(d.deadline) <= new Date()
    ),
    pendingDecisions: overdueDecisions.length,
  };
}

// ── HISTORICO MATURIDADE ───────────────────────────────────────

/**
 * Registra um snapshot de maturidade.
 *
 * Seguranca (CR-1, audit 2026-04-26): tenantId e obrigatorio. Validamos que o
 * axis pertence ao tenant antes de mutar. Sem isso, atacante autenticado em
 * tenant A poderia passar axisId de tenant B e sobrescrever score alheio.
 *
 * Atomicidade (VU-2): driver neon-http nao suporta `db.transaction()`. Por ora,
 * validamos antes e usamos defesa em profundidade no WHERE do UPDATE. Migracao
 * para neon-serverless + transaction real esta no backlog.
 */
export async function recordMaturitySnapshot(
  tenantId: string,
  axisId: string,
  score: string,
  notes?: string
) {
  const [axis] = await db
    .select({ id: sinapseMaturityAxes.id })
    .from(sinapseMaturityAxes)
    .where(and(eq(sinapseMaturityAxes.id, axisId), eq(sinapseMaturityAxes.tenantId, tenantId)))
    .limit(1);

  if (!axis) {
    throw new Error("Maturity axis not found in tenant");
  }

  await db.insert(sinapseMaturityHistory).values({
    axisId,
    score,
    notes,
  });
  await db
    .update(sinapseMaturityAxes)
    .set({
      currentScore: score,
      lastMeasuredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(sinapseMaturityAxes.id, axisId), eq(sinapseMaturityAxes.tenantId, tenantId)));
}
