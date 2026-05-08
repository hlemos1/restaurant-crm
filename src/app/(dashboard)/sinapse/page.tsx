import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Activity,
  Brain,
  Network,
  ArrowRight,
  ScrollText,
  FileText,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getNetworkStats, getAlerts, getMaturityAverage, listDecisions } from "@/services/sinapse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SinapseCockpit() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;

  const [stats, alerts, maturityAvg, recentDecisions] = await Promise.all([
    getNetworkStats(tenantId),
    getAlerts(tenantId),
    getMaturityAverage(tenantId),
    listDecisions(tenantId, { limit: 5 }),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero — saudacao + score */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight">
          Bom dia, {session.user.name?.split(" ")[0] ?? "Henrique"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {alerts.inflamedNodes.length +
            alerts.brokenCriticalSynapses.length +
            alerts.overdueDecisions.length}{" "}
          sinais de atencao na rede.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Network}
          label="Nodes"
          value={stats.nodes}
          sub={`${stats.nodeStates.inflamed} inflamados`}
        />
        <StatCard
          icon={Activity}
          label="Sinapses"
          value={stats.synapses}
          sub={`${stats.synapseStates.broken} quebradas`}
          tone={stats.synapseStates.broken > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={Brain}
          label="Maturidade"
          value={`${maturityAvg.toFixed(1)}/3`}
          sub="media de 8 eixos"
        />
        <StatCard
          icon={ScrollText}
          label="Decisoes"
          value={alerts.pendingDecisions}
          sub="pendentes"
          tone={alerts.overdueDecisions.length > 0 ? "danger" : "default"}
        />
      </section>

      {/* Alertas */}
      {(alerts.inflamedNodes.length > 0 ||
        alerts.brokenCriticalSynapses.length > 0 ||
        alerts.dormantHighWeight.length > 0) && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Alertas
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {alerts.inflamedNodes.map((n) => (
              <AlertCard
                key={n.id}
                title={n.name}
                kind="No inflamado"
                description={(n.metadata as { reason?: string })?.reason ?? "Sobrecarregado"}
                tone="warning"
              />
            ))}
            {alerts.brokenCriticalSynapses.map((s) => (
              <AlertCard
                key={s.id}
                title="Sinapse quebrada"
                kind={`peso ${s.weight}`}
                description={
                  (s.metadata as { reason?: string })?.reason ?? "Conexao critica rompida"
                }
                tone="danger"
              />
            ))}
            {alerts.dormantHighWeight.map((n) => (
              <AlertCard
                key={n.id}
                title={n.name}
                kind="No dormente (alto peso)"
                description={
                  (n.metadata as { reason?: string; note?: string })?.reason ??
                  (n.metadata as { note?: string })?.note ??
                  "Ativo desligado"
                }
                tone="warning"
              />
            ))}
          </div>
        </section>
      )}

      {/* Atalhos */}
      <section className="grid gap-4 md:grid-cols-3">
        <ShortcutCard
          href="/sinapse/mapa"
          icon={Network}
          title="Ver Mapa Neural"
          description="Visualizacao completa da rede"
        />
        <ShortcutCard
          href="/sinapse/decisoes"
          icon={ScrollText}
          title="Decisoes pendentes"
          description={`${alerts.pendingDecisions} aguardando`}
        />
        <ShortcutCard
          href="/sinapse/documentos"
          icon={FileText}
          title="Documentos"
          description="Diagnostico, atas, relatorios"
        />
      </section>

      {/* Decisoes recentes */}
      {recentDecisions.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Decisoes recentes
          </h3>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {recentDecisions.map((d) => (
                <Link
                  key={d.id}
                  href={`/sinapse/decisoes/${d.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    {d.deadline && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deadline: {new Date(d.deadline).toLocaleDateString("pt-PT")}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      d.status === "active"
                        ? "default"
                        : d.status === "done"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {d.status}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "text-primary",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className={`text-xs mt-1 ${toneClasses[tone]}`}>{sub}</p>
          </div>
          <Icon className={`w-5 h-5 ${toneClasses[tone]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function AlertCard({
  title,
  kind,
  description,
  tone,
}: {
  title: string;
  kind: string;
  description: string;
  tone: "warning" | "danger";
}) {
  const accent =
    tone === "danger" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5";
  return (
    <Card className={`border ${accent}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle
            className={`w-4 h-4 mt-0.5 shrink-0 ${
              tone === "danger" ? "text-red-500" : "text-amber-500"
            }`}
          />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase">{kind}</p>
            <p className="font-medium mt-0.5 truncate">{title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ShortcutCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
