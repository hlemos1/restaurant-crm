/**
 * Seed Sinapse — popula a rede neural do Grupo Pateo, estado pos-R5 (2026-05-08).
 *
 * Pre-requisito: `pnpm db:seed` ja rodou (cria tenants Pateo + 3 marcas).
 * Idempotente: limpa tabelas sinapse_* do tenant antes de inserir.
 *
 * Fontes canonicas:
 *   - ops/contratos/grupo-pateo-diagnostico-v4.md
 *   - ops/contratos/grupo-pateo-ata-reuniao5-francisco-lopo.md
 *   - ops/contratos/grupo-pateo-briefing-r5-plano-de-acao.md
 *
 * Conteudo: 6 camadas + 61 nodes + 75 synapses + 8 eixos com 4 snapshots cada
 *           + 8 documentos (3 diagnosticos versionados + 2 atas + 1 briefing + 1 DNA + 1 riscos)
 *           + 34 decisoes principais consolidadas (R1-R5) + 9 eventos.
 *
 * Uso: `pnpm db:seed:sinapse`
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";

config({ path: ".env.local" });

import * as core from "./schema";
import * as sinapse from "./schema-sinapse";

const schema = { ...core, ...sinapse };

async function seedSinapse() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  console.log("🧠 Seeding Sinapse para Grupo Pateo (estado pos-R5, 2026-05-08)...");

  // 1. Encontrar tenant pai
  const [pateo] = await db
    .select()
    .from(core.tenants)
    .where(eq(core.tenants.slug, "grupo-pateo"))
    .limit(1);

  if (!pateo) {
    console.error("❌ Tenant Grupo Pateo nao encontrado. Rode `pnpm db:seed` primeiro.");
    process.exit(1);
  }

  console.log(`✓ Tenant: ${pateo.name} (${pateo.id})`);

  // 2. Limpar dados Sinapse anteriores deste tenant (idempotencia)
  // IMPORTANTE: maturity_history nao tem tenantId direto, so via axisId.
  // Coletamos os axis IDs do tenant e deletamos history scoped, NAO wipe geral.
  const existingAxes = await db
    .select({ id: sinapse.sinapseMaturityAxes.id })
    .from(sinapse.sinapseMaturityAxes)
    .where(eq(sinapse.sinapseMaturityAxes.tenantId, pateo.id));

  if (existingAxes.length > 0) {
    await db.delete(sinapse.sinapseMaturityHistory).where(
      inArray(
        sinapse.sinapseMaturityHistory.axisId,
        existingAxes.map((a) => a.id)
      )
    );
  }

  await db.delete(sinapse.sinapseEvents).where(eq(sinapse.sinapseEvents.tenantId, pateo.id));
  await db.delete(sinapse.sinapseDecisions).where(eq(sinapse.sinapseDecisions.tenantId, pateo.id));
  await db.delete(sinapse.sinapseDocuments).where(eq(sinapse.sinapseDocuments.tenantId, pateo.id));
  await db.delete(sinapse.sinapseSynapses).where(eq(sinapse.sinapseSynapses.tenantId, pateo.id));
  await db.delete(sinapse.sinapseNodes).where(eq(sinapse.sinapseNodes.tenantId, pateo.id));
  await db.delete(sinapse.sinapseLayers).where(eq(sinapse.sinapseLayers.tenantId, pateo.id));
  await db
    .delete(sinapse.sinapseMaturityAxes)
    .where(eq(sinapse.sinapseMaturityAxes.tenantId, pateo.id));

  console.log("✓ Tabelas Sinapse limpas para o tenant (history scoped por axisId)");

  // ── 3. CAMADAS ────────────────────────────────────────────────

  const layersSeed = [
    {
      name: "Estrutural",
      slug: "estrutural",
      color: "#1a365d",
      icon: "Layers",
      sortOrder: 1,
      description: "Holding, conselho, governanca formal",
    },
    {
      name: "Humana",
      slug: "humana",
      color: "#b45309",
      icon: "Users",
      sortOrder: 2,
      description: "Pessoas, papeis, cultura",
    },
    {
      name: "Operacional",
      slug: "operacional",
      color: "#0f766e",
      icon: "Cog",
      sortOrder: 3,
      description: "Unidades, cozinha central, fluxo fisico",
    },
    {
      name: "Dados",
      slug: "dados",
      color: "#7c3aed",
      icon: "Database",
      sortOrder: 4,
      description: "Sistemas, integracoes, fluxos informacionais",
    },
    {
      name: "Comercial",
      slug: "comercial",
      color: "#dc2626",
      icon: "Store",
      sortOrder: 5,
      description: "Marcas, marketing, GIO, delivery",
    },
    {
      name: "Estrategica",
      slug: "estrategica",
      color: "#0891b2",
      icon: "Target",
      sortOrder: 6,
      description: "Plays, expansao, monetizacao",
    },
  ];

  const layers = await db
    .insert(sinapse.sinapseLayers)
    .values(layersSeed.map((l) => ({ ...l, tenantId: pateo.id })))
    .returning();

  const layerBySlug = Object.fromEntries(layers.map((l) => [l.slug, l]));
  console.log(`✓ ${layers.length} camadas criadas`);

  // ── 4. NODES ──────────────────────────────────────────────────

  const nodesSeed = [
    // ── ESTRUTURAL ────────────────────────────────────────
    {
      layer: "estrutural",
      type: "unit" as const,
      subtype: "office",
      slug: "grupo-pateo",
      name: "Grupo Pateo (holding)",
      weight: "10.0",
      state: "active" as const,
      metadata: { unidades: 6, faturamento_anual_eur: 5000000 },
    },
    {
      layer: "estrutural",
      type: "committee" as const,
      subtype: "governance",
      slug: "conselho-socios",
      name: "Conselho de Socios (5)",
      weight: "10.0",
      state: "inflamed" as const,
      metadata: {
        reason: "Sem CEO formal — primeiro sinal funcional R5 (Henrique exigiu plenario 5 socios)",
      },
    },

    // ── HUMANA ────────────────────────────────────────────
    {
      layer: "humana",
      type: "person" as const,
      subtype: "founder",
      slug: "francisco",
      name: "Francisco",
      weight: "9.0",
      state: "active" as const,
      metadata: { role: "Estrategia / contato consultor / hipotalamo informal" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "partner",
      slug: "felipe",
      name: "Felipe",
      weight: "8.0",
      state: "active" as const,
      metadata: { role: "Op. salao + reservas + delivery" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "partner",
      slug: "frederico",
      name: "Frederico",
      weight: "8.0",
      state: "active" as const,
      metadata: { role: "Op. cozinha" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "partner",
      slug: "lopo",
      name: "Lopo",
      weight: "8.0",
      state: "growing" as const,
      metadata: {
        role: "Supply chain + vertical Marina (R5)",
        note: "Entrou na vertical marketing R4. R5: conduz Frente A (catering)",
      },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "partner",
      slug: "bruno",
      name: "Bruno",
      weight: "6.0",
      state: "active" as const,
      metadata: { role: "Comunicacao (interface agencia)" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "manager",
      slug: "oscar",
      name: "Oscar",
      weight: "7.0",
      state: "active" as const,
      metadata: { role: "Marketing interno (R3) — contratou agencia Marte" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "manager",
      slug: "hugo",
      name: "Hugo (mkt R5)",
      weight: "7.0",
      state: "active" as const,
      metadata: {
        role: "Responsavel marketing R5",
        pending: ["mascote Petisco", "identidade visual", "paleta cores", "numero WhatsApp"],
        note: "Verificar identidade Hugo vs Oscar — R5 menciona Hugo como gatekeeper",
      },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "manager",
      slug: "pedro-mendes",
      name: "Pedro Mendes",
      weight: "8.0",
      state: "growing" as const,
      metadata: { role: "Gerente sala todas + BI manual + dono gamificacao R5" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "manager",
      slug: "martim",
      name: "Martim",
      weight: "6.0",
      state: "active" as const,
      metadata: { role: "Op. rua + entregas, irmao do Francisco" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "employee",
      slug: "maria",
      name: "Maria",
      weight: "5.0",
      state: "active" as const,
      metadata: { role: "BTG / financeiro" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "employee",
      slug: "sofia",
      name: "Sofia",
      weight: "5.0",
      state: "active" as const,
      metadata: { role: "Contabilidade AP/AR" },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "operational",
      slug: "expedidor-torre",
      name: "Expedidor WhatsApp Torre",
      weight: "7.0",
      state: "growing" as const,
      metadata: {
        role: "R5: pessoa local do salao, NAO sobe pra gerencia",
        scope: "Recebe pedido pronto da IA, repassa cozinha + Uber Direct",
        status: "a_definir_R5",
      },
    },
    {
      layer: "humana",
      type: "person" as const,
      subtype: "team",
      slug: "equipe-garcons-petisco-torre",
      name: "Garcons Petisco Torre",
      weight: "7.0",
      state: "growing" as const,
      metadata: {
        role: "Equipe operacional do piloto figital",
        incentivo: "Codigo individual + gamificacao",
      },
    },

    // ── OPERACIONAL ───────────────────────────────────────
    {
      layer: "operacional",
      type: "unit" as const,
      subtype: "kitchen",
      slug: "cozinha-central",
      name: "Cozinha Central (Torre)",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        note: "Ativo subestimado. Custa ~100k€/ano. Decisao outsourcing adiada com criterios R4 (rebate, escala, posicao parceiro)",
      },
    },
    {
      layer: "operacional",
      type: "unit" as const,
      subtype: "restaurant",
      slug: "petisco-torre",
      name: "Petisco Torre (PILOTO R5)",
      weight: "10.0",
      state: "growing" as const,
      metadata: {
        financial: "rentavel",
        piloto: "Frente B figital R5",
        primeiro_pedido_target: "2026-06-05",
        target_60d: "200+ pedidos WhatsApp",
      },
    },
    {
      layer: "operacional",
      type: "unit" as const,
      subtype: "restaurant",
      slug: "petisco-cascais",
      name: "Petisco Cascais",
      weight: "8.0",
      state: "active" as const,
      metadata: { financial: "rentavel" },
    },
    {
      layer: "operacional",
      type: "unit" as const,
      subtype: "restaurant",
      slug: "petisco-parede",
      name: "Petisco Parede",
      weight: "8.0",
      state: "active" as const,
      metadata: { financial: "rentavel" },
    },
    {
      layer: "operacional",
      type: "unit" as const,
      subtype: "restaurant",
      slug: "patio-bencao",
      name: "Patio do Bencao",
      weight: "7.0",
      state: "active" as const,
      metadata: { financial: "break-even", reposicionamento_pendente: true },
    },
    {
      layer: "operacional",
      type: "unit" as const,
      subtype: "restaurant",
      slug: "guincho-marina",
      name: "Guincho Burgues Marina",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        financial: "se_pagando",
        piloto_r5: "Frente A catering barcos",
        target_60d: "30+ pedidos, ticket medio 100€+",
      },
    },

    // ── DADOS — SISTEMAS LEGADOS ─────────────────────────
    {
      layer: "dados",
      type: "system" as const,
      subtype: "pos",
      slug: "winrest",
      name: "WinRest (POS)",
      weight: "8.0",
      state: "active" as const,
      metadata: { note: "API disponivel, dados >1 ano, fechamento diario" },
    },
    {
      layer: "dados",
      type: "system" as const,
      subtype: "erp",
      slug: "phc",
      name: "PHC (compras + faturacao)",
      weight: "8.0",
      state: "active" as const,
      metadata: { note: "Alerta margem por email automatico" },
    },
    {
      layer: "dados",
      type: "system" as const,
      subtype: "erp",
      slug: "netvo",
      name: "NetVO (agregador 6 unidades)",
      weight: "7.0",
      state: "active" as const,
      metadata: { note: "Conecta WinRest" },
    },
    {
      layer: "dados",
      type: "system" as const,
      subtype: "communication",
      slug: "webby-wifi",
      name: "Webby WiFi (MORTO)",
      weight: "0.0",
      state: "isolated" as const,
      metadata: {
        note: "MORTO — empresa de informatica faliu. Descoberto pre-R5. Captura comeca do zero pelo piloto Torre.",
        nao_religar: true,
      },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "report",
      slug: "excel-pedro",
      name: "Excel paralelo (Pedro)",
      weight: "6.0",
      state: "active" as const,
      metadata: { note: "Compilacao manual mensal — substituir por dashboard real fase 2" },
    },

    // ── DADOS — SISTEMAS PILOTO TORRE ────────────────────
    {
      layer: "dados",
      type: "system" as const,
      subtype: "pos",
      slug: "numero-interno-pos",
      name: "Numero Interno POS",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        note: "PRIMEIRA PONTE LEGADA USAVEL. Todos 100+ funcionarios em 6 unidades tem. Reaproveitado como codigo garcom R5.",
        origem: "WinRest existente",
      },
    },
    {
      layer: "dados",
      type: "system" as const,
      subtype: "ai_agent",
      slug: "ia-atendimento-torre",
      name: "IA Atendimento Torre",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        stack: "Claude Sonnet + Evolution API",
        custo_mes_eur: "150-300",
        aprovado_R5: true,
        decisao: "100% IA, sem retrabalho humano",
      },
    },
    {
      layer: "dados",
      type: "system" as const,
      subtype: "communication",
      slug: "whatsapp-business-torre",
      name: "WhatsApp Business Torre",
      weight: "9.0",
      state: "growing" as const,
      metadata: { setup_target: "Sem 1 R5", numero: "a_definir_com_hugo" },
    },
    {
      layer: "dados",
      type: "system" as const,
      subtype: "communication",
      slug: "evolution-api",
      name: "Evolution API",
      weight: "8.0",
      state: "active" as const,
      metadata: { note: "Stack ja dominado por Henrique via LARA (6+ meses)" },
    },

    // ── DADOS — DATA NODES ───────────────────────────────
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "cadastro-cliente",
      name: "Cadastro Cliente",
      weight: "1.0",
      state: "isolated" as const,
      metadata: {
        note: "Captura comeca do zero. Webby morreu. Primeiro coletor real = piloto figital Torre.",
      },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "historico-vendas",
      name: "Historico Vendas (>1 ano)",
      weight: "8.0",
      state: "active" as const,
      metadata: { fonte: "WinRest + PHC + NetVO", uso_atual: "Excel manual Pedro" },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "reviews",
      name: "Reviews",
      weight: "4.0",
      state: "dormant" as const,
      metadata: { note: "Quase zero push ativo" },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "base-whatsapp-pateo",
      name: "Base WhatsApp Pateo",
      weight: "8.0",
      state: "growing" as const,
      metadata: {
        captura: "telefone + codigo origem + valor + horario + frequencia",
        fase: "construcao via piloto Torre",
      },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "dados-uber",
      name: "Dados Uber",
      weight: "6.0",
      state: "dormant" as const,
      metadata: {
        acesso: "pendente (Francisco envia conta R5)",
        potencial: "auditar publicidade 50/50 + dimensionar raio real",
      },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "codigo-garcom",
      name: "Codigo Garcom (R5)",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        origem: "Numero Interno POS",
        regra: "Beneficio financeiro vincula codigo ao garcom (resolve compartilhamento historico)",
      },
    },
    {
      layer: "dados",
      type: "document" as const,
      subtype: "data",
      slug: "maturity-score",
      name: "Maturity Score",
      weight: "8.0",
      state: "growing" as const,
      metadata: { v1: "1.00/3", v2: "1.25/3", v3: "1.31/3", v4: "1.69/3" },
    },

    // ── COMERCIAL — MARCAS ────────────────────────────────
    {
      layer: "comercial",
      type: "brand" as const,
      subtype: "operating",
      slug: "marca-petisco",
      name: "Patio do Petisco",
      weight: "10.0",
      state: "growing" as const,
      metadata: { units: 3, replicabilidade: "ALTA — marca-mae da expansao", piloto_r5: true },
    },
    {
      layer: "comercial",
      type: "brand" as const,
      subtype: "operating",
      slug: "marca-bencao",
      name: "Patio do Bencao",
      weight: "6.0",
      state: "active" as const,
      metadata: { reposicionamento_pendente: true },
    },
    {
      layer: "comercial",
      type: "brand" as const,
      subtype: "operating",
      slug: "marca-guincho",
      name: "Patio do Guincho (premium)",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        replicabilidade: "BAIXA — premium, modelo Pateo Dubai/Manhattan futuro",
        vertical_marina: true,
      },
    },
    {
      layer: "comercial",
      type: "brand" as const,
      subtype: "operating",
      slug: "marca-burgues",
      name: "Burgues Patio",
      weight: "8.0",
      state: "active" as const,
      metadata: { replicabilidade: "ALTA — replicavel cidade a cidade" },
    },
    {
      layer: "comercial",
      type: "brand" as const,
      subtype: "dormant",
      slug: "marca-dom-teclado",
      name: "Dom Teclado",
      weight: "5.0",
      state: "dormant" as const,
      metadata: { note: "Standby — costela monoproduto. Reativar take-away Parede mes 4-5" },
    },
    {
      layer: "comercial",
      type: "system" as const,
      subtype: "agency",
      slug: "agencia-marte",
      name: "Agencia Marte",
      weight: "5.0",
      state: "inflamed" as const,
      metadata: {
        note: "Caso Pedro/Marte — ementa IA-corrompida publicada. Manual de uso IA pendente",
      },
    },

    // ── COMERCIAL — DELIVERY E LOGISTICA ─────────────────
    {
      layer: "comercial",
      type: "system" as const,
      subtype: "delivery_platform",
      slug: "uber-eats",
      name: "Uber Eats",
      weight: "7.0",
      state: "inflamed" as const,
      metadata: {
        taxa: "30%",
        margem_perdida_eur: 1800000,
        leverage: "Falha pagamento contratual ativa",
        oferta_compensacao: "15% por 1 mes (Francisco recusou — exigiu fim do ano)",
        publicidade_pendente: "€3.000 modelo 50/50 — auditar",
      },
    },
    {
      layer: "comercial",
      type: "system" as const,
      subtype: "logistics",
      slug: "uber-direct",
      name: "Uber Direct (transportador)",
      weight: "8.0",
      state: "growing" as const,
      metadata: {
        uso_r5: "Logistica do app Pateo Gol sem app Uber",
        pagamento: "100% online, sem maquininha, sem dinheiro fisico",
        repasse: "Segunda-feira",
      },
    },
    {
      layer: "comercial",
      type: "system" as const,
      subtype: "ai_app",
      slug: "app-pateo-gol",
      name: "App Pateo Gol (candidato)",
      weight: "7.0",
      state: "growing" as const,
      metadata: {
        nome_candidato: "Pateo Gol (Lopo R5)",
        validacao_pendente: "Bruno + registro de marca",
        arquitetura: "delivery proprio + agregador 3 marcas + backend cliente proprio (sem legacy)",
        cronograma: "dev sem 4, build sem 8, v0 sem 16",
      },
    },

    // ── ESTRATEGICA — COMITE E PLAYS R1-R4 ───────────────
    {
      layer: "estrategica",
      type: "committee" as const,
      subtype: "expansion",
      slug: "comite-expansao",
      name: "Comite de Expansao",
      weight: "8.0",
      state: "growing" as const,
      metadata: { plays: 7 },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "strategic_initiative",
      slug: "play-licenciamento",
      name: "Licenciamento 51/49 + €1k",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        vx: 9,
        rx: 7,
        classification: "monitor",
        modelos_por_mercado: {
          PT: "licenciamento",
          BR: "franchise",
          ES: "a_confirmar",
          USA_CN: "unidades_proprias",
        },
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "strategic_initiative",
      slug: "play-cozinha-b2b",
      name: "Cozinha Central B2B",
      weight: "8.0",
      state: "isolated" as const,
      metadata: {
        vx: 8,
        rx: 6,
        classification: "monitor",
        criterios_decisao: ["rebate", "escala", "posicao no portfolio"],
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "strategic_initiative",
      slug: "play-stock-options",
      name: "Stock options 01 unidades",
      weight: "6.0",
      state: "dormant" as const,
      metadata: { origem: "R1", status: "Conselho pendente" },
    },

    // ── ESTRATEGICA — 3 FRENTES R5 EM EXECUCAO ───────────
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "execution",
      slug: "frente-a-catering-guincho",
      name: "Frente A — Catering Marina",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        resp: "Lopo",
        target: "30+ pedidos/60d",
        ticket_medio_eur: 100,
        primeira_venda: "2026-05-22",
        dependencia_tech: "zero",
        quick_win: true,
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "execution",
      slug: "frente-b-figital-torre",
      name: "Frente B — Piloto Figital Torre",
      weight: "10.0",
      state: "growing" as const,
      metadata: {
        resp: "Henrique + Felipe + Pedro Mendes",
        target: "200+ pedidos/60d",
        ia: "100%",
        primeiro_pedido: "2026-06-05",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "execution",
      slug: "frente-c-app-pateo-gol",
      name: "Frente C — App Pateo Gol",
      weight: "7.0",
      state: "growing" as const,
      metadata: {
        resp: "Henrique constroi",
        cronograma: "dev sem 4 / build sem 8 / v0 sem 16",
        backend: "proprio sem legacy",
      },
    },

    // ── ESTRATEGICA — 6 FRENTES NOVAS R5 ─────────────────
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "product",
      slug: "play-reservas-3d",
      name: "Reservas 3D (produto proprio)",
      weight: "8.0",
      state: "growing" as const,
      metadata: {
        parceiro: "T1 (acordo existente)",
        proposta:
          "Cliente escolhe mesa por vista. Layout dinamico 2-8 pessoas. Sistema vende externo",
        precedente: "T1 modulo de reserva nasceu da dor",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "expansion",
      slug: "play-marina-internacional",
      name: "Marina como franquia premium internacional",
      weight: "8.0",
      state: "growing" as const,
      metadata: {
        rota: "Cascais → Barcelona → Dubai → Rio",
        tese: "Primeira rede de restaurantes para barcos com tecnologia + entrega + dados",
        venda_verao_2027: "ja agora",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "side_business",
      slug: "play-go-by-tesla",
      name: "Go by Tesla integrado",
      weight: "5.0",
      state: "growing" as const,
      metadata: {
        origem: "Projeto pessoal Henrique (20 motoristas Tesla cadastrados)",
        uso_pateo:
          "Cliente pede corrida + reserva mesa juntos. Diferencial Marina (estacionamento caro, turista rico)",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "platform",
      slug: "play-plataforma-educacional",
      name: "Plataforma educacional interna",
      weight: "5.0",
      state: "growing" as const,
      metadata: {
        escopo: "Cursos profissionalizantes pra 100+ funcionarios",
        modelo: "Parceria com empresa de cursos (% comissao)",
        efeito: "Brand interna + cultura",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "ux",
      slug: "play-escolha-mesa-3d",
      name: "Escolha de mesa por vista (3D)",
      weight: "6.0",
      state: "growing" as const,
      metadata: {
        hipoteses_ja_documentadas: ["criancas", "mesas grandes", "alergias"],
        overflow: "Acima de 6/8 pessoas alerta gerente",
        fricao_zero: "case bicheiro: noteiro nao puxa",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "principle",
      slug: "play-produto-generalizado",
      name: "Produto generalizado (dor interna → produto externo)",
      weight: "8.0",
      state: "growing" as const,
      metadata: {
        tese: "Toda dor interna que voce resolve com tecnologia vira produto pra vender",
        casos: ["T1 modulo reserva", "ROM happy hour do home", "Lusitanos IA pra cavalos"],
      },
    },

    // ── ESTRATEGICA — GOVERNANCA NASCENTE ────────────────
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "governance",
      slug: "play-plenario-5-socios",
      name: "Plenario 5 socios (orcamento)",
      weight: "9.0",
      state: "growing" as const,
      metadata: {
        origem: "R5 — Henrique recusou atalho 2 socios",
        tese: "Primeiro sinal de Conselho funcional",
        quem_convoca: "Francisco",
      },
    },
    {
      layer: "estrategica",
      type: "play" as const,
      subtype: "governance",
      slug: "play-ceo-formal",
      name: "Definir CEO formal",
      weight: "10.0",
      state: "dormant" as const,
      metadata: {
        bloqueia:
          "Tudo que depende de governanca formal — investidor, Conselho deliberativo, decisao em cima do dado piloto",
      },
    },
  ];

  const nodes = await db
    .insert(sinapse.sinapseNodes)
    .values(
      nodesSeed.map((n) => ({
        tenantId: pateo.id,
        layerId: layerBySlug[n.layer]!.id,
        type: n.type,
        subtype: n.subtype,
        slug: n.slug,
        name: n.name,
        weight: n.weight,
        state: n.state,
        metadata: n.metadata ?? {},
      }))
    )
    .returning();

  const nodeBySlug = Object.fromEntries(nodes.map((n) => [n.slug, n]));
  console.log(`✓ ${nodes.length} nodes criados`);

  // Helper: resolve slugs em IDs com falha-cedo. Slug invalido = explosao do seed,
  // nao decisao orfa. Veneno pequeno mas veneno (Henrique R5).
  function resolveAffectedNodes(slugs: string[] | undefined, context: string): string[] {
    if (!slugs?.length) return [];
    const missing = slugs.filter((slug) => !nodeBySlug[slug]);
    if (missing.length) {
      throw new Error(`[seed-sinapse] Missing affectedSlugs in ${context}: ${missing.join(", ")}`);
    }
    return slugs.map((slug) => nodeBySlug[slug]!.id);
  }

  // ── 5. SYNAPSES ───────────────────────────────────────────────

  const synapsesSeed = [
    // ── ESTRUTURAL ────────────────────────────────────────
    {
      source: "grupo-pateo",
      target: "conselho-socios",
      type: "operates" as const,
      weight: "10.0",
      state: "healthy" as const,
    },
    {
      source: "conselho-socios",
      target: "francisco",
      type: "operates" as const,
      weight: "9.0",
      state: "healthy" as const,
    },
    {
      source: "conselho-socios",
      target: "felipe",
      type: "operates" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "conselho-socios",
      target: "frederico",
      type: "operates" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "conselho-socios",
      target: "lopo",
      type: "operates" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "conselho-socios",
      target: "bruno",
      type: "operates" as const,
      weight: "6.0",
      state: "healthy" as const,
    },

    // SINAPSE QUEBRADA: Conselho → Operacao consolidada (sem CEO)
    {
      source: "conselho-socios",
      target: "petisco-torre",
      type: "operates" as const,
      weight: "10.0",
      state: "broken" as const,
      metadata: {
        reason:
          "Sem CEO formal — decisoes operacionais saltam direto. R5: primeiro sinal funcional via plenario 5 socios.",
      },
    },

    // R5: Conselho → Plays governanca
    {
      source: "conselho-socios",
      target: "play-plenario-5-socios",
      type: "operates" as const,
      weight: "9.0",
      state: "under_construction" as const,
      metadata: { origem: "Henrique recusou 2-a-2 R5" },
    },
    {
      source: "conselho-socios",
      target: "play-ceo-formal",
      type: "operates" as const,
      weight: "10.0",
      state: "broken" as const,
      metadata: { reason: "Pendente desde R1, sem deliberacao" },
    },

    // ── HUMANA — HIERARQUIA ──────────────────────────────
    {
      source: "felipe",
      target: "pedro-mendes",
      type: "reports_to" as const,
      weight: "8.0",
      state: "healthy" as const,
      bidirectional: false,
    },
    {
      source: "felipe",
      target: "martim",
      type: "operates" as const,
      weight: "6.0",
      state: "healthy" as const,
    },
    {
      source: "felipe",
      target: "expedidor-torre",
      type: "operates" as const,
      weight: "8.0",
      state: "under_construction" as const,
      metadata: { decisao_r5: "Felipe absorve OU contrata pessoa local" },
    },
    {
      source: "francisco",
      target: "maria",
      type: "operates" as const,
      weight: "5.0",
      state: "healthy" as const,
    },
    {
      source: "francisco",
      target: "sofia",
      type: "operates" as const,
      weight: "5.0",
      state: "healthy" as const,
    },
    {
      source: "bruno",
      target: "oscar",
      type: "operates" as const,
      weight: "6.0",
      state: "healthy" as const,
    },
    {
      source: "bruno",
      target: "hugo",
      type: "operates" as const,
      weight: "7.0",
      state: "growing" as const,
      metadata: { note: "R5: gatekeeper marketing, Henrique respeita governanca informal" },
    },
    {
      source: "oscar",
      target: "agencia-marte",
      type: "operates" as const,
      weight: "5.0",
      state: "inflamed" as const,
      metadata: { reason: "Caso Pedro/Marte — output humano nao validado" },
    },
    {
      source: "pedro-mendes",
      target: "equipe-garcons-petisco-torre",
      type: "operates" as const,
      weight: "8.0",
      state: "growing" as const,
      metadata: { gamificacao: "ranking codigos por garcom" },
    },

    // ── OPERACIONAL — COZINHA CENTRAL → UNIDADES ─────────
    {
      source: "cozinha-central",
      target: "petisco-torre",
      type: "supplies" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "cozinha-central",
      target: "petisco-cascais",
      type: "supplies" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "cozinha-central",
      target: "petisco-parede",
      type: "supplies" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "cozinha-central",
      target: "patio-bencao",
      type: "supplies" as const,
      weight: "7.0",
      state: "healthy" as const,
    },
    {
      source: "cozinha-central",
      target: "guincho-marina",
      type: "supplies" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "frederico",
      target: "cozinha-central",
      type: "operates" as const,
      weight: "9.0",
      state: "healthy" as const,
    },

    // ── DADOS — FLUXOS LEGADOS ───────────────────────────
    {
      source: "winrest",
      target: "netvo",
      type: "feeds" as const,
      weight: "7.0",
      state: "healthy" as const,
      latencyMs: 3600000,
    },
    {
      source: "netvo",
      target: "excel-pedro",
      type: "feeds" as const,
      weight: "6.0",
      state: "healthy" as const,
      latencyMs: 86400000,
    },
    // SINAPSE QUEBRADA: WinRest → PHC nao se falam
    {
      source: "winrest",
      target: "phc",
      type: "feeds" as const,
      weight: "8.0",
      state: "broken" as const,
      metadata: { reason: "Vendas e compras desconectadas — gap critico" },
    },
    // SINAPSE ISOLADA: Webby morto
    {
      source: "webby-wifi",
      target: "cadastro-cliente",
      type: "feeds" as const,
      weight: "0.0",
      state: "broken" as const,
      metadata: {
        reason: "MORTO — empresa faliu. Captura comeca do zero pelo piloto Torre.",
        removed_R5: true,
      },
    },
    {
      source: "winrest",
      target: "historico-vendas",
      type: "feeds" as const,
      weight: "9.0",
      state: "healthy" as const,
    },
    {
      source: "phc",
      target: "historico-vendas",
      type: "feeds" as const,
      weight: "8.0",
      state: "healthy" as const,
    },
    {
      source: "pedro-mendes",
      target: "conselho-socios",
      type: "feeds" as const,
      weight: "6.0",
      state: "under_construction" as const,
      metadata: { reason: "Relatorio mensal nao vira rotina formal de decisao" },
    },

    // ── DADOS — PILOTO TORRE (R5 NOVAS) ──────────────────
    {
      source: "winrest",
      target: "numero-interno-pos",
      type: "supplies" as const,
      weight: "9.0",
      state: "healthy" as const,
      metadata: { note: "Numero interno ja existe em todas as 6 unidades" },
    },
    {
      source: "numero-interno-pos",
      target: "codigo-garcom",
      type: "feeds" as const,
      weight: "9.0",
      state: "under_construction" as const,
      metadata: {
        decisao_r5: "Reaproveitar base existente. Beneficio financeiro vincula codigo ao garcom",
      },
    },
    {
      source: "codigo-garcom",
      target: "equipe-garcons-petisco-torre",
      type: "feeds" as const,
      weight: "9.0",
      state: "under_construction" as const,
      metadata: {
        regra: "Cliente pede no WhatsApp em 48h com codigo = ganha desconto direcionado",
      },
    },
    {
      source: "evolution-api",
      target: "whatsapp-business-torre",
      type: "supplies" as const,
      weight: "9.0",
      state: "growing" as const,
    },
    {
      source: "whatsapp-business-torre",
      target: "ia-atendimento-torre",
      type: "feeds" as const,
      weight: "9.0",
      state: "under_construction" as const,
    },
    {
      source: "ia-atendimento-torre",
      target: "expedidor-torre",
      type: "feeds" as const,
      weight: "9.0",
      state: "under_construction" as const,
      metadata: { fluxo: "IA fecha pedido → expedidor confere → cozinha + Uber Direct" },
    },
    {
      source: "expedidor-torre",
      target: "petisco-torre",
      type: "operates" as const,
      weight: "8.0",
      state: "under_construction" as const,
    },
    {
      source: "ia-atendimento-torre",
      target: "base-whatsapp-pateo",
      type: "feeds" as const,
      weight: "9.0",
      state: "under_construction" as const,
      metadata: { captura: "telefone + codigo origem + valor + horario + frequencia" },
    },
    {
      source: "uber-direct",
      target: "petisco-torre",
      type: "supplies" as const,
      weight: "8.0",
      state: "under_construction" as const,
      metadata: { logistica: "Sem app Uber, transportador apenas" },
    },

    // ── DADOS — UBER EATS (RELACIONAMENTO TENSO) ─────────
    {
      source: "uber-eats",
      target: "marca-petisco",
      type: "communicates" as const,
      weight: "6.0",
      state: "inflamed" as const,
      metadata: {
        reason: "Falha contratual Uber = leverage Pateo. Compensacao 15% por 1 mes recusada.",
      },
    },
    {
      source: "uber-eats",
      target: "dados-uber",
      type: "feeds" as const,
      weight: "7.0",
      state: "dormant" as const,
      metadata: { acesso_pendente: "Francisco envia conta R5" },
    },

    // ── COMERCIAL — MARCAS ↔ UNIDADES ────────────────────
    {
      source: "marca-petisco",
      target: "petisco-torre",
      type: "operates" as const,
      weight: "10.0",
      state: "healthy" as const,
    },
    {
      source: "marca-petisco",
      target: "petisco-cascais",
      type: "operates" as const,
      weight: "9.0",
      state: "healthy" as const,
    },
    {
      source: "marca-petisco",
      target: "petisco-parede",
      type: "operates" as const,
      weight: "9.0",
      state: "healthy" as const,
    },
    {
      source: "marca-bencao",
      target: "patio-bencao",
      type: "operates" as const,
      weight: "7.0",
      state: "healthy" as const,
    },
    {
      source: "marca-guincho",
      target: "guincho-marina",
      type: "operates" as const,
      weight: "9.0",
      state: "healthy" as const,
    },
    {
      source: "marca-burgues",
      target: "guincho-marina",
      type: "operates" as const,
      weight: "8.0",
      state: "healthy" as const,
      metadata: { note: "Burgues + Guincho compartilham unidade Marina" },
    },

    // SILO QUEBRADO: marcas nao se falam
    {
      source: "marca-petisco",
      target: "marca-guincho",
      type: "competes" as const,
      weight: "5.0",
      state: "broken" as const,
      metadata: { reason: "Cliente Burgues nao conecta ao Petisco — sem cross-selling" },
    },
    {
      source: "marca-petisco",
      target: "marca-burgues",
      type: "competes" as const,
      weight: "5.0",
      state: "broken" as const,
      metadata: { reason: "Sem cross-selling cidade a cidade" },
    },

    // ── COMERCIAL — HUGO ↔ MARCAS ────────────────────────
    {
      source: "hugo",
      target: "marca-petisco",
      type: "operates" as const,
      weight: "8.0",
      state: "under_construction" as const,
      metadata: { pendencia: "mascote + identidade visual + paleta" },
    },
    {
      source: "hugo",
      target: "app-pateo-gol",
      type: "operates" as const,
      weight: "7.0",
      state: "under_construction" as const,
      metadata: { pendencia: "validar nome + numero WhatsApp" },
    },
    {
      source: "hugo",
      target: "whatsapp-business-torre",
      type: "operates" as const,
      weight: "8.0",
      state: "under_construction" as const,
      metadata: { pendencia: "numero + identidade canal" },
    },

    // ── ESTRATEGICA — COMITE → PLAYS ─────────────────────
    {
      source: "comite-expansao",
      target: "play-licenciamento",
      type: "operates" as const,
      weight: "9.0",
      state: "under_construction" as const,
    },
    {
      source: "comite-expansao",
      target: "play-cozinha-b2b",
      type: "operates" as const,
      weight: "8.0",
      state: "under_construction" as const,
    },
    {
      source: "comite-expansao",
      target: "play-stock-options",
      type: "operates" as const,
      weight: "6.0",
      state: "dormant" as const,
    },
    {
      source: "play-cozinha-b2b",
      target: "cozinha-central",
      type: "depends_on" as const,
      weight: "8.0",
      state: "under_construction" as const,
    },

    // ── ESTRATEGICA — 3 FRENTES R5 ───────────────────────
    {
      source: "lopo",
      target: "frente-a-catering-guincho",
      type: "operates" as const,
      weight: "10.0",
      state: "growing" as const,
      metadata: { autonomia_pendente: "Conselho aprovar" },
    },
    {
      source: "frente-a-catering-guincho",
      target: "guincho-marina",
      type: "operates" as const,
      weight: "9.0",
      state: "growing" as const,
      metadata: { dependencia_tech: "zero", primeira_venda: "2026-05-22" },
    },
    {
      source: "frente-b-figital-torre",
      target: "petisco-torre",
      type: "operates" as const,
      weight: "10.0",
      state: "growing" as const,
    },
    {
      source: "frente-b-figital-torre",
      target: "ia-atendimento-torre",
      type: "depends_on" as const,
      weight: "10.0",
      state: "under_construction" as const,
    },
    {
      source: "frente-b-figital-torre",
      target: "codigo-garcom",
      type: "depends_on" as const,
      weight: "9.0",
      state: "under_construction" as const,
    },
    {
      source: "frente-c-app-pateo-gol",
      target: "app-pateo-gol",
      type: "operates" as const,
      weight: "10.0",
      state: "growing" as const,
    },
    {
      source: "frente-c-app-pateo-gol",
      target: "uber-direct",
      type: "depends_on" as const,
      weight: "8.0",
      state: "under_construction" as const,
    },
    {
      source: "frente-c-app-pateo-gol",
      target: "frente-b-figital-torre",
      type: "feeds" as const,
      weight: "9.0",
      state: "growing" as const,
      metadata: { tese: "App nasce com 200+ pedidos historico, equipe treinada, IA validada" },
    },

    // ── ESTRATEGICA — 6 FRENTES NOVAS R5 ─────────────────
    {
      source: "play-reservas-3d",
      target: "marca-petisco",
      type: "supplies" as const,
      weight: "7.0",
      state: "under_construction" as const,
      metadata: { parceiro: "T1" },
    },
    {
      source: "play-reservas-3d",
      target: "play-produto-generalizado",
      type: "feeds" as const,
      weight: "8.0",
      state: "growing" as const,
      metadata: { case: "Dor interna vira produto vendavel" },
    },
    {
      source: "play-marina-internacional",
      target: "guincho-marina",
      type: "operates" as const,
      weight: "8.0",
      state: "growing" as const,
      metadata: { rota: "Cascais → Barcelona → Dubai → Rio" },
    },
    {
      source: "play-marina-internacional",
      target: "frente-a-catering-guincho",
      type: "depends_on" as const,
      weight: "9.0",
      state: "growing" as const,
      metadata: { tese: "Frente A valida hipotese, Marina internacional escala" },
    },
    {
      source: "play-go-by-tesla",
      target: "app-pateo-gol",
      type: "feeds" as const,
      weight: "5.0",
      state: "growing" as const,
      metadata: { uso: "Cliente pede corrida + reserva mesa juntos" },
    },
    {
      source: "play-go-by-tesla",
      target: "guincho-marina",
      type: "supplies" as const,
      weight: "5.0",
      state: "growing" as const,
      metadata: { diferencial: "Estacionamento caro Marina, turista rico" },
    },
    {
      source: "play-plataforma-educacional",
      target: "equipe-garcons-petisco-torre",
      type: "supplies" as const,
      weight: "5.0",
      state: "under_construction" as const,
    },
    {
      source: "play-escolha-mesa-3d",
      target: "play-reservas-3d",
      type: "feeds" as const,
      weight: "7.0",
      state: "growing" as const,
    },

    // ── PRINCIPIO TRANSVERSAL ─────────────────────────────
    {
      source: "play-produto-generalizado",
      target: "play-reservas-3d",
      type: "supplies" as const,
      weight: "8.0",
      state: "growing" as const,
    },
    {
      source: "play-produto-generalizado",
      target: "play-marina-internacional",
      type: "supplies" as const,
      weight: "7.0",
      state: "growing" as const,
    },
  ];

  const synapses = await db
    .insert(sinapse.sinapseSynapses)
    .values(
      synapsesSeed.map((s) => ({
        tenantId: pateo.id,
        sourceNodeId: nodeBySlug[s.source]!.id,
        targetNodeId: nodeBySlug[s.target]!.id,
        type: s.type,
        weight: s.weight,
        state: s.state,
        bidirectional: s.bidirectional ?? false,
        latencyMs: s.latencyMs ?? null,
        metadata: s.metadata ?? {},
      }))
    )
    .returning();

  console.log(`✓ ${synapses.length} synapses criadas`);

  // ── 6. MATURITY AXES (scores v4 — pos-R5) ─────────────────────

  const axesSeed = [
    {
      name: "Governanca",
      slug: "governanca",
      currentScore: "0.5",
      targetScore: "3.0",
      sortOrder: 1,
      description:
        "CEO formal + conselho administrativo. R5: Henrique exigiu plenario 5 socios — primeiro sinal funcional.",
    },
    {
      name: "Processos documentados",
      slug: "processos",
      currentScore: "2.0",
      targetScore: "3.0",
      sortOrder: 2,
      description: "R5: 17 parametros explicitos + 9 principios autorais codificados.",
    },
    {
      name: "Dados organizados",
      slug: "dados",
      currentScore: "1.5",
      targetScore: "3.0",
      sortOrder: 3,
      description: "WinRest+PHC+NetVO ativos. Webby morto (R5). Captura cliente comeca do zero.",
    },
    {
      name: "Ferramentas integradas",
      slug: "ferramentas",
      currentScore: "1.5",
      targetScore: "3.0",
      sortOrder: 4,
      description: "Numero interno POS = primeira ponte legada usavel.",
    },
    {
      name: "Cultura de mudanca",
      slug: "cultura",
      currentScore: "3.0",
      targetScore: "3.0",
      sortOrder: 5,
      description: "Confirmado em 5 reunioes. Excepcional.",
    },
    {
      name: "Decisao por dado",
      slug: "decisao-dado",
      currentScore: "1.0",
      targetScore: "3.0",
      sortOrder: 6,
      description:
        "Decisoes seguem por percepcao. Primeiro dado real chega via piloto Torre (2026-06-05).",
    },
    {
      name: "Autonomia operacional",
      slug: "autonomia",
      currentScore: "2.0",
      targetScore: "3.0",
      sortOrder: 7,
      description:
        "R5: Lopo conduz vertical Marina. Expedidor local definido. Codigo garcom = numero interno.",
    },
    {
      name: "Memoria institucional",
      slug: "memoria",
      currentScore: "2.0",
      targetScore: "3.0",
      sortOrder: 8,
      description:
        "5 atas + 4 diagnosticos versionados + 17 parametros + 9 principios. Documento substituiu memoria oral.",
    },
  ];

  const axes = await db
    .insert(sinapse.sinapseMaturityAxes)
    .values(
      axesSeed.map((a) => ({ ...a, tenantId: pateo.id, lastMeasuredAt: new Date("2026-05-08") }))
    )
    .returning();

  console.log(`✓ ${axes.length} eixos de maturidade criados`);

  // ── 7. MATURITY HISTORY (4 snapshots por eixo: v1, v2, v3, v4) ──

  const axesBySlug = Object.fromEntries(axes.map((a) => [a.slug, a]));

  const historyData: Array<{ axisSlug: string; v1: string; v2: string; v3: string; v4: string }> = [
    { axisSlug: "governanca", v1: "0.0", v2: "0.0", v3: "0.0", v4: "0.5" },
    { axisSlug: "processos", v1: "0.5", v2: "1.0", v3: "1.5", v4: "2.0" },
    { axisSlug: "dados", v1: "1.0", v2: "2.0", v3: "1.5", v4: "1.5" },
    { axisSlug: "ferramentas", v1: "1.0", v2: "1.0", v3: "1.0", v4: "1.5" },
    { axisSlug: "cultura", v1: "3.0", v2: "3.0", v3: "3.0", v4: "3.0" },
    { axisSlug: "decisao-dado", v1: "1.0", v2: "1.0", v3: "1.0", v4: "1.0" },
    { axisSlug: "autonomia", v1: "1.0", v2: "1.0", v3: "1.5", v4: "2.0" },
    { axisSlug: "memoria", v1: "0.0", v2: "1.0", v3: "1.5", v4: "2.0" },
  ];

  // Convencao: measuredAt = data da REUNIAO que produziu o estado medido.
  // Notes carrega data de redacao do diagnostico quando difere da reuniao
  // (caso v3: medido na R4 2026-05-07, escrito 2026-05-08 a partir do consolidado).
  const versionDates: Record<"v1" | "v2" | "v3" | "v4", Date> = {
    v1: new Date("2026-04-22"), // R1 com Francisco
    v2: new Date("2026-04-25"), // R3 com Oscar (consolidado pos R1-R3)
    v3: new Date("2026-05-07"), // R4 com Oscar+Lopo (diagnostico escrito 2026-05-08)
    v4: new Date("2026-05-08"), // R5 com Francisco+Lopo
  };
  const versionNotes: Record<"v1" | "v2" | "v3" | "v4", string> = {
    v1: "Diagnostico v1 (R1 2026-04-22)",
    v2: "Diagnostico v2 (consolidado R1-R3, 2026-04-25)",
    v3: "Diagnostico v3 (medido na R4 2026-05-07, redigido em 2026-05-08)",
    v4: "Diagnostico v4 canonico (R5 2026-05-08)",
  };

  const historyValues = historyData.flatMap((h) => {
    const axis = axesBySlug[h.axisSlug]!;
    return (["v1", "v2", "v3", "v4"] as const).map((v) => ({
      axisId: axis.id,
      score: h[v],
      notes: versionNotes[v],
      measuredAt: versionDates[v],
    }));
  });

  await db.insert(sinapse.sinapseMaturityHistory).values(historyValues);
  console.log(`✓ ${historyValues.length} snapshots de maturidade (8 eixos × 4 versoes)`);

  // ── 8. DOCUMENTOS ─────────────────────────────────────────────

  const [docDiagV2] = await db
    .insert(sinapse.sinapseDocuments)
    .values({
      tenantId: pateo.id,
      type: "diagnosis",
      title: "Diagnostico Grupo Pateo v2",
      slug: "diagnostico-v2",
      version: 2,
      isLatest: false,
      contentMd:
        "# Diagnostico Grupo Pateo v2\n\n> Consolidado pos R1-R3 (22-24 abril 2026). Score 1.25/3.\n\nVer `ops/contratos/grupo-pateo-diagnostico-v2.md` para versao completa.",
      metadata: { source: "R1+R2+R3", score: "1.25/3" },
    })
    .returning();

  const [docDiagV3] = await db
    .insert(sinapse.sinapseDocuments)
    .values({
      tenantId: pateo.id,
      type: "diagnosis",
      title: "Diagnostico Grupo Pateo v3",
      slug: "diagnostico-v3",
      version: 3,
      isLatest: false,
      parentDocId: docDiagV2!.id,
      contentMd:
        "# Diagnostico Grupo Pateo v3\n\n> Pos-R4 (2026-05-07). Score 1.31/3.\n\nReframe critico: Webby morto (empresa faliu). Captura cliente comeca do zero pelo piloto Torre.\n\nVer `ops/contratos/grupo-pateo-diagnostico-v3.md` para versao completa.",
      metadata: { source: "R1-R4", score: "1.31/3", reframe: "webby_morto" },
    })
    .returning();

  await db.insert(sinapse.sinapseDocuments).values({
    tenantId: pateo.id,
    type: "diagnosis",
    title: "Diagnostico Grupo Pateo v4 (canonico)",
    slug: "diagnostico-v4",
    version: 4,
    isLatest: true,
    parentDocId: docDiagV3!.id,
    contentMd:
      '# Diagnostico Grupo Pateo v4 (canonico)\n\n> Pos-R5 (2026-05-08). Score 1.69/3.\n\n## Tese central\n\n- "Voce exponencializa e ganha dinheiro com algo que nao e o teu core." (Henrique R5)\n- "Voce pode automatizar o meio. Nunca as pontas." (Henrique R4)\n- "Temos tanto tempo a absorver os dados que nao conseguimos fazer analise." (Felipe R2)\n\n## Salto +0.38 motivado por:\n\n1. Aterrissagem operacional (3 frentes em arranque + 6 frentes novas)\n2. Parametrizacao explicita (17 parametros + 9 principios)\n3. Henrique exigindo plenario 5 socios = primeira sinalizacao de Conselho funcional\n4. Numero interno do POS = primeira ponte legada usavel\n\n## Limite estrutural\n\nScore nao passa de 2.0 sem (a) CEO formal, (b) Conselho deliberativo com atas, (c) primeiros dados reais do piloto Torre.\n\nVer `ops/contratos/grupo-pateo-diagnostico-v4.md` para versao completa.',
    metadata: { source: "R1-R5", score: "1.69/3", canonico: true },
  });

  await db.insert(sinapse.sinapseDocuments).values({
    tenantId: pateo.id,
    type: "meeting_minutes",
    title: "Ata R4 — Marketing R2 (Oscar + Lopo + Francisco)",
    slug: "ata-r4-marketing",
    version: 1,
    isLatest: true,
    contentMd:
      '# Ata R4 (2026-05-07)\n\nAterrissou piloto: Patio do Petisco / Torre. App "Pateo". Delivery proprio prioritario. Lopo entrou na vertical marketing. Patio do Guincho NAO replica agora (premium). Cozinha central decisao adiada com criterios.\n\nVer `ops/contratos/grupo-pateo-ata-reuniao4-marketing-r2.md`.',
    metadata: { participantes: ["Oscar", "Francisco", "Lopo"] },
  });

  await db.insert(sinapse.sinapseDocuments).values({
    tenantId: pateo.id,
    type: "meeting_minutes",
    title: "Ata R5 — Apresentacao Tese CORTEX3 (Francisco + Lopo)",
    slug: "ata-r5-francisco-lopo",
    version: 1,
    isLatest: true,
    contentMd:
      '# Ata R5 (2026-05-08)\n\nApresentacao da tese CORTEX3 ao cliente. Francisco e Lopo aprovaram o frame neural.\n\n## 12 decisoes fechadas\n\n1. Marina = vendedor humano premium (NAO automatizar)\n2. Torre figital = IA 100% (sem retrabalho humano)\n3. Codigo do garcom = numero interno POS\n4. Beneficio financeiro vincula codigo (resolve compartilhamento)\n5. Expedidor WhatsApp = pessoa local salao\n6. Loop retencao 2x = sobremesa horario fraco\n7. Reservas 3D = produto proprio (T1 parceiro)\n8. Marina vende verao 2027 ja agora\n9. Pagamento Uber Direct = 100% online\n10. Nome candidato app: "Pateo Gol" (Lopo)\n11. Orcamento Evolution + Claude aprovado (Henrique absorve)\n12. Gamificacao = pontos com flexibilidade\n\n## 6 frentes novas mapeadas\n\nReservas 3D / Marina internacional / Go by Tesla integrado / Plataforma educacional / Escolha mesa 3D / Produto generalizado.\n\nVer `ops/contratos/grupo-pateo-ata-reuniao5-francisco-lopo.md`.',
    metadata: { participantes: ["Francisco", "Lopo"], tese_cortex3: "aprovada" },
  });

  await db.insert(sinapse.sinapseDocuments).values({
    tenantId: pateo.id,
    type: "briefing",
    title: "Briefing R5 — Plano de Acao (60 dias)",
    slug: "briefing-r5-plano-de-acao",
    version: 1,
    isLatest: true,
    contentMd:
      "# Briefing R5 — Plano de Acao\n\n3 frentes em arranque:\n\n- **Frente A — Catering Marina** (Lopo): primeira venda 2026-05-22, target 30+ pedidos/60d, ticket €100+\n- **Frente B — Figital Torre** (Henrique + Felipe + Pedro Mendes): primeiro pedido 2026-06-05, target 200+ pedidos/60d, IA 100%\n- **Frente C — App Pateo Gol** (Henrique constroi): dev sem 4, build sem 8, v0 sem 16\n\nArquitetura tecnica: NFC + codigo garcom + WhatsApp Business + Evolution API + Claude Sonnet + Uber Direct.\n\nVer `ops/contratos/grupo-pateo-briefing-r5-plano-de-acao.md`.",
    metadata: { cronograma_dias: 60 },
  });

  await db.insert(sinapse.sinapseDocuments).values({
    tenantId: pateo.id,
    type: "sop",
    title: "DNA Operacional Pateo — 17 Parametros + 9 Principios",
    slug: "dna-operacional-r5",
    version: 1,
    isLatest: true,
    contentMd:
      '# DNA Operacional Grupo Pateo\n\n> Codificado na R5 (2026-05-08). 10 parametros fundamentais + 7 negociaveis + 9 principios autorais.\n\n## Parametros fundamentais (imutaveis — DNA)\n\n1. Output do humano em peca publica\n2. Tudo que esta no menu tem que ter\n3. Banheiro sujo = cozinha pior\n4. Conta primeiro, intangivel depois\n5. Precisa ajuda no horario forte = incompetencia (foco no fraco)\n6. Tempo entrega < 15 min ideal, > 30 min mata marca\n7. Cliente sente entrega por tempo, nao por taxa\n8. Decisoes de orcamento = 5 socios em plenario\n9. Pensar fraude antes de funcionalidade\n10. Tudo que resolve dor interna pode virar produto vendavel\n\n## Parametros negociaveis (definidos por dado)\n\n1. Raio entrega Torre (3 / 5 / 10 km)\n2. % desconto codigo garcom\n3. Frete (cliente vs Pateo)\n4. Ticket medio minimo desconto\n5. Volume max IA/dia\n6. Composicao gamificacao\n7. Janela retencao 48h\n\n## Parametros direcionais\n\n- Pateo = local digital. Cada unidade = tipo de Pateo\n- Petisco/Burgues replicam, Guincho NAO replica agora\n- Marina = nicho de franquia premium internacional\n- Cozinha central = ativo subestimado, criterios antes de outsourcing\n- Figital Torre = IA 100% / Marina = humano premium\n- WhatsApp = interface principal de consulta\n- Empresa = rede neural com nos, sinapses e pesos contextuais\n\n## 9 Principios autorais\n\n1. "O dinheiro exponencial esta no que nao e seu core"\n2. "Pode automatizar o meio. Nunca as pontas"\n3. "Quem fica com o dado fica com o ouro"\n4. "Um noteiro nao puxa. Sugar, aceitar." (case bicheiro: fricao zero)\n5. "Toda automacao com retrabalho humano e lixo"\n6. "Cara de visao raiz me apresenta cara de visao raiz" (rede como ativo)\n7. "Sei dar ordem porque sei seguir ordem" (governanca)\n8. "Texto > Brain" (parametrizar tudo)\n9. "Output do humano sempre"',
    metadata: { categoria: "DNA", parametros_count: 17, principios_count: 9, fonte: "R5" },
  });

  await db.insert(sinapse.sinapseDocuments).values({
    tenantId: pateo.id,
    type: "report",
    title: "Riscos Ativos R5 — Mapa de mitigacao",
    slug: "riscos-r5",
    version: 1,
    isLatest: true,
    contentMd:
      '# Riscos Ativos Pos-R5\n\n> Severidades alinhadas com `grupo-pateo-ata-reuniao5-francisco-lopo.md` secao 8 e `grupo-pateo-diagnostico-v4.md`.\n\n## Severidade ALTA\n\n- **Publicidade Uber 50/50** — "50 dele = 0". Henrique audita conta antes de aprovar gasto €3.000\n- **Tempo entrega > 30 min queima marca** — raio dimensionado por performance real Uber, nao por geografia\n- **IA Torre 100% + falhar = stress operacional** — ground truth obrigatorio + integracao status real-time fase 2\n- **Decisao orcamento entre 2 socios (sem outros 3)** — Henrique recusou. Plenario 5 obrigatorio.\n\n## Severidade MEDIA\n\n- **Mascote indefinido bloqueia NFC** — reuniao Hugo sem 1 trava ou destrava producao chaveirinhos. Severidade media: bloqueia uma frente, nao queima marca\n- **Fraude codigo garcom** (passar codigo de colega) — codigo associado a beneficio direto + auditoria expedidor\n- **Confusao Pateo (marca) x Pateo Gol (app)** — Bruno valida registro\n- **Cozinha central outsourcing = perda autonomia** — decidir so com criterios completos\n\n## Severidade BAIXA\n\n- **Catering Guincho sem demanda real** — comecar via 3-5 contatos marina (Lopo)\n- **Delivery proprio canibalizando salao** — modelo "diluir pico", desconto so horario fraco',
    metadata: { categoria: "riscos", severidades: { alta: 4, media: 4, baixa: 2 } },
  });

  console.log(
    `✓ 8 documentos criados (3 diagnosticos versionados v2/v3/v4 + 2 atas R4/R5 + 1 briefing R5 + 1 DNA + 1 riscos)`
  );

  // ── 9. DECISOES (R1-R5 consolidadas) ──────────────────────────

  type DecisionInput = {
    title: string;
    description: string;
    status: "pending" | "active" | "done" | "reverted";
    affectedSlugs?: string[];
    decidedBy?: string[];
    deadline?: Date;
    decidedAt?: Date;
    completedAt?: Date;
    criteria?: Record<string, unknown>;
  };

  const decisionsSeed: DecisionInput[] = [
    // ── R1-R4 (estruturais) ────────────────────────────
    {
      title: "Definir CEO formal do Grupo Pateo",
      description:
        "Sem CEO unico, decisoes triviais consomem 5 socios. Investidor / fundo / banco nao olha empresa sem governanca. R5: primeiro sinal funcional via plenario 5 socios.",
      status: "pending",
      affectedSlugs: ["conselho-socios", "play-ceo-formal"],
      decidedBy: ["conselho-socios"],
      deadline: new Date("2026-06-15"),
      criteria: { peso: 10, bloqueia: ["governanca", "investidor", "decisao_em_cima_de_dado"] },
    },
    {
      title: "Reativar Webby (WiFi captacao de cliente)",
      description:
        "REVERTIDO em R5: Webby morreu (empresa de informatica faliu). Nao ha como religar. Captura comeca do zero pelo piloto figital Torre.",
      status: "reverted",
      affectedSlugs: ["webby-wifi"],
      decidedBy: ["francisco"],
      decidedAt: new Date("2026-04-25"),
      completedAt: new Date("2026-05-08"),
      criteria: { reframe_r5: "empresa_faliu" },
    },
    {
      title: "Liberar acessos a WinRest, PHC, NetVO + Drive compartilhado",
      description:
        "Sem acesso, consultor trabalha no escuro. Dados ja existem (>1 ano). Quanto antes processar, antes vira diagnostico real.",
      status: "active",
      affectedSlugs: ["winrest", "phc", "netvo"],
      decidedBy: ["francisco"],
      deadline: new Date("2026-04-29"),
    },
    {
      title: "Modelo de expansao 51% holding + 49% socio-operador + €1k/mes licenciamento",
      description:
        "Mercados PT licenciamento, BR franchise, ES a confirmar, USA/CN unidades proprias. Possivel 10% para gerente local.",
      status: "active",
      affectedSlugs: ["play-licenciamento", "comite-expansao"],
      decidedBy: ["conselho-socios"],
      decidedAt: new Date("2026-04-23"),
    },
    {
      title: "Cozinha central — decisao outsourcing adiada com criterios",
      description:
        "NAO E AGORA. Antes de decidir: rebate parceiro? Garante preco melhor por escala? Posicao Pateo no portfolio do parceiro?",
      status: "pending",
      affectedSlugs: ["play-cozinha-b2b", "cozinha-central"],
      decidedBy: ["conselho-socios"],
      criteria: { rebate: "?", escala: "?", posicao_portfolio: "?" },
    },
    {
      title: "Stock options para 01 de cada unidade",
      description: "Falacia do porteiro: vincular gerente operacional ao resultado da unidade.",
      status: "pending",
      affectedSlugs: ["play-stock-options"],
      decidedBy: ["conselho-socios"],
    },
    {
      title: "Notion como hub de execucao + Obsidian como cerebro de conhecimento",
      description: "Markdown como formato padrao (compativel com IA).",
      status: "active",
      decidedAt: new Date("2026-04-22"),
    },

    // ── R5 — DECISOES FECHADAS ────────────────────────
    {
      title: "Marina = NAO automatizar. Vendedor humano premium",
      description:
        'Henrique R5: "tipo o vendedor de Gucci, de Mercedes, nao de fusca". Ticket medio €500. Cliente premium nao quer IA.',
      status: "active",
      affectedSlugs: ["frente-a-catering-guincho", "guincho-marina"],
      decidedBy: ["lopo", "francisco", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Torre figital = IA 100%, sem retrabalho humano",
      description:
        'Henrique R5: "toda automacao com retrabalho humano e lixo". Garcom so vende codigo, IA fecha pedido completo.',
      status: "active",
      affectedSlugs: ["frente-b-figital-torre", "ia-atendimento-torre", "petisco-torre"],
      decidedBy: ["francisco", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Codigo do garcom = numero interno POS existente",
      description:
        "Todos os 100+ funcionarios das 6 unidades ja tem numero interno. Reaproveitamento = primeira ponte legada usavel.",
      status: "active",
      affectedSlugs: ["codigo-garcom", "numero-interno-pos", "winrest"],
      decidedBy: ["lopo", "francisco", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Beneficio financeiro vincula codigo ao garcom",
      description:
        'Lopo R5: "a partir do momento que recebo pelo que registro, eu nao vou esquecer do meu". Resolve problema historico de codigos compartilhados.',
      status: "active",
      affectedSlugs: ["codigo-garcom", "equipe-garcons-petisco-torre"],
      decidedBy: ["lopo", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Expedidor WhatsApp = pessoa local do salao",
      description:
        "NAO sobe pra gerencia. Esta no local, recebe pedido pronto da IA, repassa cozinha + Uber Direct.",
      status: "active",
      affectedSlugs: ["expedidor-torre", "petisco-torre"],
      decidedBy: ["francisco", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Loop infinito de retencao — cliente pede 2x = sobremesa gratis",
      description:
        'Direcionada pro horario fraco (segunda-feira almoco). Modelo ROM "happy hour do home". Diluir pico, nao canibalizar salao.',
      status: "active",
      affectedSlugs: ["frente-b-figital-torre", "base-whatsapp-pateo"],
      decidedBy: ["henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Reservas 3D = produto proprio do grupo (T1 parceiro)",
      description:
        'Henrique tem produto pronto via parceiro T1. Vira produto vendavel pra outros restaurantes. Caso "dor interna vira produto externo".',
      status: "active",
      affectedSlugs: ["play-reservas-3d", "play-produto-generalizado"],
      decidedBy: ["henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Marina vende verao 2027 ja agora (reservas adiantadas)",
      description:
        'Catering Marina + posicionamento internacional. Lopo: "venda um verao adiantado".',
      status: "active",
      affectedSlugs: ["frente-a-catering-guincho", "play-marina-internacional"],
      decidedBy: ["lopo", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Pagamento Uber Direct = 100% online",
      description:
        "Sem maquininha. Sem dinheiro fisico. Cliente paga online, repasse Uber→Pateo na segunda-feira. Taxa = topo da cadeia (30%).",
      status: "active",
      affectedSlugs: ["uber-direct"],
      decidedBy: ["francisco", "henrique"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: 'Nome candidato app: "Pateo Gol"',
      description:
        "Sugestao Lopo R5. Validar registro de marca com Bruno antes de identidade visual.",
      status: "pending",
      affectedSlugs: ["app-pateo-gol", "frente-c-app-pateo-gol"],
      decidedBy: ["bruno", "lopo"],
      deadline: new Date("2026-05-22"),
    },
    {
      title: "Orcamento Evolution API + Claude Sonnet aprovado",
      description: "~150-300€/mes no piloto. Henrique absorve no piloto inicial.",
      status: "active",
      affectedSlugs: ["evolution-api", "ia-atendimento-torre"],
      decidedBy: ["henrique"],
      decidedAt: new Date("2026-05-08"),
      criteria: { custo_mes_eur: "150-300", absorvido_por: "henrique_piloto" },
    },
    {
      title: "Gamificacao = pontos com flexibilidade",
      description:
        'Folga + dinheiro + premio + experiencia. Lopo R5: "posso querer juntar 100 pontos para receber TV no Macra". Pendencia: aprovacao Conselho dos valores.',
      status: "active",
      affectedSlugs: ["equipe-garcons-petisco-torre", "play-plenario-5-socios"],
      decidedBy: ["henrique", "francisco"],
      decidedAt: new Date("2026-05-08"),
    },
    {
      title: "Posicionamento marcas: Petisco + Burgues replicam, Guincho NAO",
      description:
        "Petisco/Burgues = marca-mae da expansao (replicaveis cidade a cidade). Guincho = premium nao replicar agora (modelo Pateo Dubai/Manhattan futuro).",
      status: "active",
      affectedSlugs: ["marca-petisco", "marca-burgues", "marca-guincho"],
      decidedBy: ["lopo", "francisco", "henrique"],
      decidedAt: new Date("2026-05-07"),
    },
    {
      title: 'Naming convention: "Pateo = local"',
      description:
        'Cada unidade fisica = tipo de Pateo (do Petisco, do Guincho, Dubai, Manhattan). App = "Pateo Gol" (local digital).',
      status: "active",
      decidedAt: new Date("2026-05-07"),
    },
    {
      title: "Foco temporal: Mai-Set turista / Out-Mar local",
      description:
        "Nao exclui publico — ajusta prioridade de comunicacao. Verao 2026 = janela turista. Inverno = codigo garcom + NFC + recorrencia local.",
      status: "active",
      decidedAt: new Date("2026-05-07"),
    },

    // ── R5 — DECISOES PENDENTES ──────────────────────
    {
      title: "Reuniao Hugo (marketing) — semana que vem",
      description:
        "Bloqueia: identidade visual, mascote Petisco, paleta cores, numero WhatsApp Pateo Torre.",
      status: "pending",
      affectedSlugs: ["hugo", "marca-petisco", "whatsapp-business-torre"],
      decidedBy: ["henrique"],
      deadline: new Date("2026-05-15"),
    },
    {
      title: "Acesso conta Uber Eats (analise)",
      description:
        "Bloqueia: analise raio + auditoria publicidade €3.000 modelo 50/50. Henrique audita antes de aprovar gasto.",
      status: "pending",
      affectedSlugs: ["uber-eats", "dados-uber"],
      decidedBy: ["francisco"],
      deadline: new Date("2026-05-15"),
    },
    {
      title: "Politica de gamificacao — aprovacao Conselho",
      description:
        "Valores e regras. Pedro Mendes precisa luz verde pra implementar ranking + premios escalonados.",
      status: "pending",
      affectedSlugs: ["conselho-socios", "equipe-garcons-petisco-torre"],
      decidedBy: ["conselho-socios"],
      deadline: new Date("2026-05-15"),
    },
    {
      title: "Autonomia Lopo na vertical Marina",
      description: "Conselho confirma se Lopo conduz catering Guincho como projeto proprio dele.",
      status: "pending",
      affectedSlugs: ["lopo", "frente-a-catering-guincho"],
      decidedBy: ["conselho-socios"],
      deadline: new Date("2026-05-15"),
    },
    {
      title: "Plenario 5 socios para orcamento (NAO 2-a-2)",
      description:
        'Henrique R5: "tem participacao dos outros para validar, nao entrar so no teu rabo e no meu de role". Primeira sinalizacao de Conselho funcional.',
      status: "pending",
      affectedSlugs: ["conselho-socios", "play-plenario-5-socios"],
      decidedBy: ["francisco"],
      deadline: new Date("2026-05-15"),
    },
    {
      title: "Treinamento Torre — Felipe + Pedro Mendes + equipe",
      description:
        "Curso de comunicacao interna. Modelo presencial → presencial+video → so video. Gamificacao integrada (codigos por garcom).",
      status: "pending",
      affectedSlugs: ["expedidor-torre", "equipe-garcons-petisco-torre", "petisco-torre"],
      decidedBy: ["henrique"],
      deadline: new Date("2026-05-22"),
    },
    {
      title: "Mascote Patio do Petisco",
      description: "Bloqueia producao NFC chaveirinhos (farm 3D Henrique pronta).",
      status: "pending",
      affectedSlugs: ["hugo", "marca-petisco"],
      decidedBy: ["bruno", "hugo"],
      deadline: new Date("2026-05-15"),
    },

    // ── R5 — RISCOS COMO DECISIONS PENDING ───────────
    {
      title: "RISCO: Mitigacao fraude codigo garcom",
      description:
        "1 garcom pode passar codigo de colega. Mitigacao: codigo associado a beneficio direto (R5) + auditoria expedidor + numero interno fixo do POS.",
      status: "pending",
      affectedSlugs: ["codigo-garcom"],
      criteria: { severidade: "media" },
    },
    {
      title: "RISCO: Auditoria publicidade Uber 50/50",
      description:
        'Uber pediu €3.000 modelo 50/50. Henrique R5: "o 50% dele e zero. O meu 50% e 100%". Mitigacao: auditar conta antes de aprovar gasto.',
      status: "pending",
      affectedSlugs: ["uber-eats", "dados-uber"],
      criteria: { severidade: "alta", investimento_em_risco_eur: 3000 },
    },
    {
      title: "RISCO: Tempo entrega > 30 min queima marca",
      description:
        "Cliente sente entrega por tempo, nao por taxa. Raio dimensionado por performance real Uber.",
      status: "active",
      affectedSlugs: ["uber-direct", "petisco-torre"],
      criteria: { severidade: "alta", limite_min: 30, ideal_min: 15 },
    },
    {
      title: "RISCO: IA Torre 100% + falhar = stress operacional",
      description:
        "Ground truth obrigatorio (menu Markdown/JSON com preco, modificadores, prazo, disponibilidade) + integracao status real-time fase 2.",
      status: "active",
      affectedSlugs: ["ia-atendimento-torre", "frente-b-figital-torre"],
      criteria: { severidade: "alta", mitigacao: "ground_truth + status_real_time_fase_2" },
    },
    {
      title: "RISCO: Confusao Pateo (marca) x Pateo Gol (app)",
      description: "Bruno valida registro de marca antes de identidade visual.",
      status: "pending",
      affectedSlugs: ["marca-petisco", "app-pateo-gol"],
      criteria: { severidade: "media" },
    },
  ];

  await db.insert(sinapse.sinapseDecisions).values(
    decisionsSeed.map((d) => ({
      tenantId: pateo.id,
      title: d.title,
      description: d.description,
      status: d.status,
      affectedNodes: resolveAffectedNodes(d.affectedSlugs, `decision: ${d.title}`),
      decidedBy: d.decidedBy ?? [],
      decidedAt: d.decidedAt,
      deadline: d.deadline,
      completedAt: d.completedAt,
      criteria: d.criteria ?? {},
    }))
  );

  console.log(`✓ ${decisionsSeed.length} decisoes R1-R5 inseridas`);

  // ── 10. EVENTOS ──────────────────────────────────────────────

  await db.insert(sinapse.sinapseEvents).values([
    {
      tenantId: pateo.id,
      type: "data_ingest",
      source: "manual",
      occurredAt: new Date("2026-04-22"),
      rawContent: "Bootstrap inicial Sinapse — Grupo Pateo. R1 com Francisco. Score 1.00/3.",
      payload: { meeting: "R1", score: "1.00/3" },
    },
    {
      tenantId: pateo.id,
      type: "meeting",
      source: "manual",
      occurredAt: new Date("2026-04-23"),
      rawContent:
        "R2 — Diagnostico tecnico/operacional com Francisco + Felipe. Tese: dado existe, falta camada de inteligencia.",
      payload: {
        meeting: "R2",
        participants: ["Francisco", "Felipe"],
        tese: "dado_existe_falta_inteligencia",
      },
    },
    {
      tenantId: pateo.id,
      type: "meeting",
      source: "manual",
      occurredAt: new Date("2026-04-24"),
      rawContent:
        "R3 — Marketing/GIO com Francisco + Oscar. Vertical GIO formalizada. Plataforma Naia score 64.",
      payload: { meeting: "R3", participants: ["Francisco", "Oscar"], vertical: "GIO" },
    },
    {
      tenantId: pateo.id,
      type: "meeting",
      source: "manual",
      occurredAt: new Date("2026-05-07"),
      rawContent:
        "R4 — Marketing R2 com Oscar + Francisco + Lopo. Aterrissou piloto Torre, app Pateo, delivery proprio prioritario, catering Marina.",
      payload: { meeting: "R4", participants: ["Oscar", "Francisco", "Lopo"], score: "1.31/3" },
    },
    {
      tenantId: pateo.id,
      type: "meeting",
      source: "manual",
      occurredAt: new Date("2026-05-08"),
      rawContent:
        "R5 — Apresentacao Tese CORTEX3 a Francisco + Lopo. Aprovada como frame operacional. 12 decisoes fechadas + 6 frentes novas.",
      payload: {
        meeting: "R5",
        participants: ["Francisco", "Lopo"],
        score: "1.69/3",
        tese_cortex3: "aprovada",
        decisoes_fechadas: 12,
        frentes_novas: 6,
      },
    },
    {
      tenantId: pateo.id,
      type: "node_state_change",
      source: "manual",
      occurredAt: new Date("2026-05-08"),
      relatedNodeId: nodeBySlug["webby-wifi"]!.id,
      rawContent:
        "Webby/WebIt v2 declarado MORTO (empresa de informatica faliu). Reframe: captura cliente comeca do zero pelo piloto Torre.",
      payload: { node: "webby-wifi", from: "dormant", to: "isolated", reason: "empresa_faliu" },
    },
    {
      tenantId: pateo.id,
      type: "human_validation",
      source: "manual",
      occurredAt: new Date("2026-05-08"),
      rawContent:
        "Henrique recusou atalho 2-socios para orcamento. Exigiu plenario 5 socios. Primeiro sinal de Conselho funcional.",
      payload: {
        decisao: "plenario_5_socios",
        origem: "R5",
        efeito: "score_governanca_0.0_to_0.5",
      },
    },
    {
      tenantId: pateo.id,
      type: "ai_suggestion",
      source: "manual",
      occurredAt: new Date("2026-05-08"),
      rawContent:
        "Apresentacao da Tese CORTEX3 ao cliente. Rede neural Obsidian, hipotalamo, sinapses com peso, telao. Aprovada por Francisco e Lopo. Lopo fez analogia automatica com a propria operacao.",
      payload: {
        evento: "tese_cortex3_apresentada",
        aprovacao: true,
        analogia_lopo: "codigo_pos_gerentes_compartilhados",
      },
    },
    {
      tenantId: pateo.id,
      type: "metric_snapshot",
      source: "manual",
      occurredAt: new Date("2026-05-08"),
      rawContent: "Salto de maturidade pos-R5: 1.31 → 1.69 (+0.38).",
      payload: {
        score_v3: "1.31/3",
        score_v4: "1.69/3",
        delta: "+0.38",
        motivos: [
          "aterrissagem_operacional_3_frentes_em_arranque",
          "parametrizacao_explicita_17_parametros_9_principios",
          "henrique_exigiu_plenario_5_socios",
          "numero_interno_pos_primeira_ponte_legada",
        ],
      },
    },
  ]);

  console.log(`✓ 9 eventos registrados (R1-R5 + reframe Webby + tese aprovada + salto maturidade)`);

  console.log(`
🧠 Sinapse seed pos-R5 completo. Pateo tenant zero atualizado.

   Camadas:    ${layers.length}
   Nodes:      ${nodes.length}  (${nodes.filter((n) => n.state === "growing").length} growing, ${nodes.filter((n) => n.state === "active").length} active, ${nodes.filter((n) => n.state === "inflamed").length} inflamed, ${nodes.filter((n) => n.state === "dormant").length} dormant, ${nodes.filter((n) => n.state === "isolated").length} isolated)
   Synapses:   ${synapses.length}  (${synapses.filter((s) => s.state === "broken").length} broken, ${synapses.filter((s) => s.state === "under_construction").length} under_construction, ${synapses.filter((s) => s.state === "growing").length} growing, ${synapses.filter((s) => s.state === "healthy").length} healthy, ${synapses.filter((s) => s.state === "dormant").length} dormant)
   Eixos:      ${axes.length}     (history: ${historyValues.length} snapshots)
   Documentos: 8                  (3 diagnosticos versionados v2/v3/v4 + 2 atas R4/R5 + 1 briefing R5 + 1 DNA + 1 riscos)
   Decisoes:   ${decisionsSeed.length}
   Eventos:    9
   Score atual: 1.69/3 (salto +0.38 em R5)
  `);

  process.exit(0);
}

seedSinapse().catch((err) => {
  console.error("❌ Erro no seed Sinapse:", err);
  process.exit(1);
});
