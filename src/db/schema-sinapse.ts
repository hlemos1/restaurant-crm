/**
 * SINAPSE — schema do modulo de rede neural empresarial.
 *
 * Tabelas isoladas das 39 do Nexial existente. Reusam tenants/users via FK.
 * Convencao: prefixo `sinapse_` em todas as tabelas para evitar colisao.
 *
 * Primitivas: layer -> node -> synapse -> event. Decisions e documents derivam.
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { tenants, users } from "./schema";

// ── Tipos compartilhados (varchar + type narrowing TS) ──────────

export const NODE_TYPES = [
  "person",
  "unit",
  "brand",
  "system",
  "committee",
  "play",
  "document",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_STATES = ["active", "dormant", "inflamed", "isolated", "growing"] as const;
export type NodeState = (typeof NODE_STATES)[number];

export const SYNAPSE_TYPES = [
  "reports_to",
  "operates",
  "feeds",
  "funds",
  "communicates",
  "competes",
  "depends_on",
  "supplies",
] as const;
export type SynapseType = (typeof SYNAPSE_TYPES)[number];

export const SYNAPSE_STATES = ["healthy", "broken", "under_construction", "dormant"] as const;
export type SynapseState = (typeof SYNAPSE_STATES)[number];

export const EVENT_TYPES = [
  "meeting",
  "decision",
  "transcription",
  "data_ingest",
  "metric_snapshot",
  "node_state_change",
  "synapse_state_change",
  "node_created",
  "node_updated",
  "synapse_created",
  "synapse_updated",
  "ai_suggestion",
  "human_validation",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DECISION_STATUSES = ["pending", "active", "done", "reverted"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "diagnosis",
  "meeting_minutes",
  "report",
  "contract",
  "sop",
  "briefing",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// ── 1. Layers (camadas neurais) ─────────────────────────────────

export const sinapseLayers = pgTable(
  "sinapse_layers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull(),
    color: varchar("color", { length: 20 }).notNull(),
    icon: varchar("icon", { length: 50 }),
    sortOrder: integer("sort_order").notNull().default(0),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_layers_tenant_idx").on(table.tenantId),
    uniqueIndex("sinapse_layers_tenant_slug_idx").on(table.tenantId, table.slug),
  ]
);

// ── 2. Nodes (neuronios) ────────────────────────────────────────

export const sinapseNodes = pgTable(
  "sinapse_nodes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    layerId: text("layer_id")
      .notNull()
      .references(() => sinapseLayers.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 30 }).notNull().$type<NodeType>(),
    subtype: varchar("subtype", { length: 50 }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    weight: decimal("weight", { precision: 3, scale: 1 }).notNull().default("5.0"),
    state: varchar("state", { length: 20 }).notNull().default("active").$type<NodeState>(),
    metadata: jsonb("metadata").default({}),
    positionX: decimal("position_x", { precision: 8, scale: 2 }),
    positionY: decimal("position_y", { precision: 8, scale: 2 }),
    lastPulseAt: timestamp("last_pulse_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_nodes_tenant_idx").on(table.tenantId),
    index("sinapse_nodes_layer_idx").on(table.tenantId, table.layerId),
    index("sinapse_nodes_type_idx").on(table.tenantId, table.type, table.state),
    uniqueIndex("sinapse_nodes_tenant_slug_idx").on(table.tenantId, table.slug),
  ]
);

// ── 3. Synapses (conexoes tipadas entre nodes) ──────────────────

export const sinapseSynapses = pgTable(
  "sinapse_synapses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => sinapseNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => sinapseNodes.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull().$type<SynapseType>(),
    weight: decimal("weight", { precision: 3, scale: 1 }).notNull().default("5.0"),
    state: varchar("state", { length: 30 }).notNull().default("healthy").$type<SynapseState>(),
    bidirectional: boolean("bidirectional").default(false),
    latencyMs: integer("latency_ms"),
    metadata: jsonb("metadata").default({}),
    lastPulseAt: timestamp("last_pulse_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_synapses_tenant_idx").on(table.tenantId),
    index("sinapse_synapses_source_idx").on(table.tenantId, table.sourceNodeId),
    index("sinapse_synapses_target_idx").on(table.tenantId, table.targetNodeId),
    index("sinapse_synapses_state_idx").on(table.tenantId, table.state),
  ]
);

// ── 4. Events (append-only — projecao do estado) ────────────────

export const sinapseEvents = pgTable(
  "sinapse_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull().$type<EventType>(),
    source: varchar("source", { length: 30 }).notNull().default("manual"),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    relatedNodeId: text("related_node_id").references(() => sinapseNodes.id, {
      onDelete: "set null",
    }),
    relatedSynapseId: text("related_synapse_id").references(() => sinapseSynapses.id, {
      onDelete: "set null",
    }),
    rawContent: text("raw_content"),
    payload: jsonb("payload").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_events_tenant_time_idx").on(table.tenantId, table.occurredAt),
    index("sinapse_events_type_idx").on(table.tenantId, table.type),
    index("sinapse_events_node_idx").on(table.tenantId, table.relatedNodeId),
  ]
);

// ── 5. Decisions (audit trail formal) ───────────────────────────

export const sinapseDecisions = pgTable(
  "sinapse_decisions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    originEventId: text("origin_event_id").references(() => sinapseEvents.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    decidedBy: jsonb("decided_by").default([]),
    criteria: jsonb("criteria").default({}),
    outcome: text("outcome"),
    status: varchar("status", { length: 20 }).notNull().default("pending").$type<DecisionStatus>(),
    affectedNodes: jsonb("affected_nodes").default([]),
    affectedSynapses: jsonb("affected_synapses").default([]),
    decidedAt: timestamp("decided_at"),
    deadline: timestamp("deadline"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_decisions_tenant_idx").on(table.tenantId),
    index("sinapse_decisions_status_idx").on(table.tenantId, table.status),
    index("sinapse_decisions_deadline_idx").on(table.tenantId, table.deadline),
  ]
);

// ── 6. Documents (markdown versionado via parentDocId) ──────────

export const sinapseDocuments = pgTable(
  "sinapse_documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull().$type<DocumentType>(),
    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    contentMd: text("content_md").notNull().default(""),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentDocId: text("parent_doc_id").references((): any => sinapseDocuments.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull().default(1),
    isLatest: boolean("is_latest").notNull().default(true),
    metadata: jsonb("metadata").default({}),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_documents_tenant_idx").on(table.tenantId),
    index("sinapse_documents_type_idx").on(table.tenantId, table.type, table.isLatest),
    index("sinapse_documents_slug_idx").on(table.tenantId, table.slug, table.version),
  ]
);

// ── 7. Maturity Axes (eixos de avaliacao 0-3) ───────────────────

export const sinapseMaturityAxes = pgTable(
  "sinapse_maturity_axes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull(),
    description: text("description"),
    currentScore: decimal("current_score", { precision: 3, scale: 1 }).notNull().default("0.0"),
    targetScore: decimal("target_score", { precision: 3, scale: 1 }).notNull().default("3.0"),
    sortOrder: integer("sort_order").notNull().default(0),
    lastMeasuredAt: timestamp("last_measured_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sinapse_maturity_axes_tenant_idx").on(table.tenantId),
    uniqueIndex("sinapse_maturity_axes_slug_idx").on(table.tenantId, table.slug),
  ]
);

// ── 8. Maturity History (snapshots temporais por eixo) ──────────

export const sinapseMaturityHistory = pgTable(
  "sinapse_maturity_history",
  {
    id: serial("id").primaryKey(),
    axisId: text("axis_id")
      .notNull()
      .references(() => sinapseMaturityAxes.id, { onDelete: "cascade" }),
    score: decimal("score", { precision: 3, scale: 1 }).notNull(),
    notes: text("notes"),
    measuredAt: timestamp("measured_at").defaultNow().notNull(),
  },
  (table) => [index("sinapse_maturity_history_axis_idx").on(table.axisId, table.measuredAt)]
);

// ── Relations (para queries com .with) ──────────────────────────

export const sinapseLayersRelations = relations(sinapseLayers, ({ many }) => ({
  nodes: many(sinapseNodes),
}));

export const sinapseNodesRelations = relations(sinapseNodes, ({ one, many }) => ({
  layer: one(sinapseLayers, {
    fields: [sinapseNodes.layerId],
    references: [sinapseLayers.id],
  }),
  outgoingSynapses: many(sinapseSynapses, { relationName: "source" }),
  incomingSynapses: many(sinapseSynapses, { relationName: "target" }),
}));

export const sinapseSynapsesRelations = relations(sinapseSynapses, ({ one }) => ({
  source: one(sinapseNodes, {
    fields: [sinapseSynapses.sourceNodeId],
    references: [sinapseNodes.id],
    relationName: "source",
  }),
  target: one(sinapseNodes, {
    fields: [sinapseSynapses.targetNodeId],
    references: [sinapseNodes.id],
    relationName: "target",
  }),
}));

export const sinapseEventsRelations = relations(sinapseEvents, ({ one }) => ({
  actor: one(users, {
    fields: [sinapseEvents.actorUserId],
    references: [users.id],
  }),
  relatedNode: one(sinapseNodes, {
    fields: [sinapseEvents.relatedNodeId],
    references: [sinapseNodes.id],
  }),
  relatedSynapse: one(sinapseSynapses, {
    fields: [sinapseEvents.relatedSynapseId],
    references: [sinapseSynapses.id],
  }),
}));

export const sinapseDecisionsRelations = relations(sinapseDecisions, ({ one }) => ({
  originEvent: one(sinapseEvents, {
    fields: [sinapseDecisions.originEventId],
    references: [sinapseEvents.id],
  }),
}));

export const sinapseDocumentsRelations = relations(sinapseDocuments, ({ one }) => ({
  creator: one(users, {
    fields: [sinapseDocuments.createdBy],
    references: [users.id],
  }),
}));

export const sinapseMaturityAxesRelations = relations(sinapseMaturityAxes, ({ many }) => ({
  history: many(sinapseMaturityHistory),
}));

export const sinapseMaturityHistoryRelations = relations(sinapseMaturityHistory, ({ one }) => ({
  axis: one(sinapseMaturityAxes, {
    fields: [sinapseMaturityHistory.axisId],
    references: [sinapseMaturityAxes.id],
  }),
}));
