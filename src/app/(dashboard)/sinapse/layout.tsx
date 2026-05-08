import Link from "next/link";
import { Network, GitGraph, ScrollText, FileText, Activity } from "lucide-react";

const tabs = [
  { href: "/sinapse", label: "Cockpit", icon: Activity, exact: true },
  { href: "/sinapse/mapa", label: "Mapa Neural", icon: GitGraph },
  { href: "/sinapse/decisoes", label: "Decisoes", icon: ScrollText },
  { href: "/sinapse/documentos", label: "Documentos", icon: FileText },
];

export default function SinapseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header com sub-nav */}
      <header className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Sinapse</h1>
              <p className="text-xs text-muted-foreground">
                Rede neural empresarial — operacao do hipotalamo
              </p>
            </div>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Conteudo */}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
