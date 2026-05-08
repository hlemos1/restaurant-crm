import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";

import { auth } from "@/lib/auth";
import { listDecisions } from "@/services/sinapse";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusVariants = {
  pending: "outline",
  active: "default",
  done: "secondary",
  reverted: "destructive",
} as const;

export default async function DecisoesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const decisions = await listDecisions(session.user.tenantId);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Decisoes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Audit trail de toda decisao tomada na rede.
        </p>
      </header>

      {decisions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Nenhuma decisao registada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {decisions.map((d) => {
              const overdue =
                d.deadline && d.status === "pending" && new Date(d.deadline) <= new Date();
              return (
                <Link
                  key={d.id}
                  href={`/sinapse/decisoes/${d.id}`}
                  className="flex items-start gap-4 p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={statusVariants[d.status] ?? "outline"} className="capitalize">
                        {d.status}
                      </Badge>
                      {overdue && (
                        <Badge variant="destructive" className="text-xs">
                          Atrasada
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium">{d.title}</p>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {d.description}
                      </p>
                    )}
                    {d.deadline && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Deadline:{" "}
                        {new Date(d.deadline).toLocaleDateString("pt-PT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground mt-1" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
