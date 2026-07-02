import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sops } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createRateLimiter, RateLimitError, RateLimitUnavailableError } from "@/lib/rate-limit";

const chatLimiter = createRateLimiter({
  limit: 10,
  interval: 60_000,
  prefix: "chat",
  uniqueTokenPerInterval: 500,
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Nao autorizado", { status: 401 });
  }

  // Rate limit: 10 requests/min per user
  try {
    await chatLimiter.check(session.user.id!);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return new Response("Limite de requisicoes excedido. Tente em 1 minuto.", { status: 429 });
    }
    if (e instanceof RateLimitUnavailableError) {
      return new Response("Serviço temporariamente indisponível. Tente novamente.", {
        status: 503,
      });
    }
    throw e;
  }

  const user = session.user;
  const tenantId = user.tenantId as string;
  const tenantName = (user.tenantName as string) || "Restaurante";

  if (!tenantId) {
    return new Response("Sem tenant", { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("Clone em treinamento — ANTHROPIC_API_KEY nao configurada", {
      status: 503,
    });
  }

  const { messages, department } = await req.json();

  if (!department || !messages) {
    return new Response("department e messages sao obrigatorios", { status: 400 });
  }

  // Busca SOPs publicados do tenant filtrados por categoria/departamento
  const tenantSops = await db
    .select({ title: sops.title, content: sops.content })
    .from(sops)
    .where(
      and(eq(sops.tenantId, tenantId), eq(sops.category, department), eq(sops.status, "published"))
    );

  // Monta bloco de conhecimento com SOPs
  const sopBlock =
    tenantSops.length > 0
      ? tenantSops
          .map((s, i) => `### SOP ${i + 1}: ${s.title}\n${s.content || "Sem conteudo."}`)
          .join("\n\n")
      : "Nenhum SOP disponivel para este departamento.";

  const departmentInstructions: Record<string, string> = {
    marketing: `Alem de consultar SOPs, voce ajuda a:
- Gerar textos para posts em redes sociais (Instagram, Facebook)
- Redigir respostas a avaliacoes online (Google, TripAdvisor)
- Criar descricoes de pratos para o menu digital
- Sugerir campanhas e promocoes sazonais
Sempre adapte o tom ao estilo do restaurante.`,
  };

  const extraInstructions = departmentInstructions[department] || "";

  const systemPrompt = `Voce e o assistente operacional do departamento "${department}" do restaurante "${tenantName}".

## Base de Conhecimento (SOPs)
${sopBlock}

## Instrucoes
- Responda como assistente operacional deste departamento.
- Use os SOPs acima como base de conhecimento principal.
- Seja direto e pratico.
- Se a pergunta nao estiver coberta pelos SOPs, diga isso e ofereça orientacao geral.
- Responda em portugues.
- Nao invente procedimentos — se nao ha SOP sobre o tema, informe.
${extraInstructions}`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}
