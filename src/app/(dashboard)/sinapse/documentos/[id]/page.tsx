import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { getDocument } from "@/services/sinapse";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ id: string }>;
}

const typeLabels: Record<string, string> = {
  diagnosis: "Diagnostico",
  meeting_minutes: "Ata",
  report: "Relatorio",
  contract: "Contrato",
  sop: "SOP",
  briefing: "Briefing",
};

export default async function DocumentDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { id } = await params;
  const doc = await getDocument(session.user.tenantId, id);
  if (!doc) notFound();

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link
        href="/sinapse/documentos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para documentos
      </Link>

      <header>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">{typeLabels[doc.type] ?? doc.type}</Badge>
          <Badge variant="secondary">v{doc.version}</Badge>
          {doc.isLatest && (
            <Badge variant="default" className="text-xs">
              ultima versao
            </Badge>
          )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{doc.title}</h2>
        <p className="text-xs text-muted-foreground mt-2">
          Atualizado em{" "}
          {new Date(doc.updatedAt).toLocaleString("pt-PT", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </header>

      <Card>
        <CardContent className="p-6">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {doc.contentMd}
            </pre>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
