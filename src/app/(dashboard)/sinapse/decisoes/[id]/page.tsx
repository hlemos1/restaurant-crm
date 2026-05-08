import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Calendar, AlertTriangle } from "lucide-react";

import { auth } from "@/lib/auth";
import { getDecision } from "@/services/sinapse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ id: string }>;
}

const statusVariants = {
  pending: "outline",
  active: "default",
  done: "secondary",
  reverted: "destructive",
} as const;

export default async function DecisionDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { id } = await params;
  const decision = await getDecision(session.user.tenantId, id);
  if (!decision) notFound();

  const overdue =
    decision.deadline && decision.status === "pending" && new Date(decision.deadline) <= new Date();

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link
        href="/sinapse/decisoes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para decisoes
      </Link>

      <header>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={statusVariants[decision.status] ?? "outline"} className="capitalize">
            {decision.status}
          </Badge>
          {overdue && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Atrasada
            </Badge>
          )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{decision.title}</h2>
      </header>

      {decision.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Contexto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{decision.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {decision.deadline && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Deadline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {new Date(decision.deadline).toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </CardContent>
          </Card>
        )}

        {Boolean(decision.criteria) &&
          Object.keys((decision.criteria ?? {}) as object).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Criterios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(decision.criteria ?? {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
      </div>

      {decision.outcome && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{decision.outcome}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Criada em</span>
            <span>{new Date(decision.createdAt).toLocaleString("pt-PT")}</span>
          </div>
          {decision.decidedAt && (
            <div className="flex justify-between">
              <span>Decidida em</span>
              <span>{new Date(decision.decidedAt).toLocaleString("pt-PT")}</span>
            </div>
          )}
          {decision.completedAt && (
            <div className="flex justify-between">
              <span>Concluida em</span>
              <span>{new Date(decision.completedAt).toLocaleString("pt-PT")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
