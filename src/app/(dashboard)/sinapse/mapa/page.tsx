import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getNetwork, getNetworkStats } from "@/services/sinapse";
import { Card, CardContent } from "@/components/ui/card";
import { NeuralMap } from "@/components/sinapse/NeuralMap";

export default async function MapaPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;

  const [network, stats] = await Promise.all([getNetwork(tenantId), getNetworkStats(tenantId)]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mapa Neural</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.layers} camadas · {stats.nodes} nodes · {stats.synapses} sinapses (
            {stats.synapseStates.broken} quebradas, {stats.synapseStates.dormant} dormentes)
          </p>
        </div>
      </header>

      {network.nodes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Rede vazia. Rode{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">pnpm db:seed:sinapse</code>{" "}
              para popular o Pateo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <NeuralMap layers={network.layers} nodes={network.nodes} synapses={network.synapses} />
      )}
    </div>
  );
}
