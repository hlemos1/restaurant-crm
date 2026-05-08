import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";

import { auth } from "@/lib/auth";
import { listDocuments } from "@/services/sinapse";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const typeLabels: Record<string, string> = {
  diagnosis: "Diagnostico",
  meeting_minutes: "Ata",
  report: "Relatorio",
  contract: "Contrato",
  sop: "SOP",
  briefing: "Briefing",
};

export default async function DocumentosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const docs = await listDocuments(session.user.tenantId);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Documentos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Markdown versionado. Cada edicao gera nova versao mantendo a anterior.
        </p>
      </header>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhum documento ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/sinapse/documentos/${doc.id}`}
                className="flex items-start gap-4 p-4 hover:bg-accent transition-colors"
              >
                <FileText className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[doc.type] ?? doc.type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      v{doc.version}
                    </Badge>
                  </div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atualizado em {new Date(doc.updatedAt).toLocaleDateString("pt-PT")}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-1" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
