"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UtensilsCrossed,
  LogOut,
  Loader2,
  BookOpen,
  BarChart3,
  Settings,
  ClipboardCheck,
  FileText,
  FolderOpen,
  ListChecks,
  Trophy,
  GraduationCap,
  Bot,
  Zap,
  TrendingUp,
  Brain,
  ShieldCheck,
  HelpCircle,
  Activity,
  GitGraph,
  ScrollText,
  Network,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import TenantSwitcher from "@/components/TenantSwitcher";
import { useTenantTheme } from "@/components/TenantThemeProvider";

interface NavSection {
  title: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navSections: NavSection[] = [
  {
    title: "Plataforma",
    items: [
      { href: "/", label: "Hub", icon: LayoutDashboard },
      { href: "/ajuda", label: "Ajuda", icon: HelpCircle },
    ],
  },
  {
    title: "Sinapse",
    items: [
      { href: "/sinapse", label: "Cockpit", icon: Activity },
      { href: "/sinapse/mapa", label: "Mapa Neural", icon: GitGraph },
      { href: "/sinapse/decisoes", label: "Decisoes", icon: ScrollText },
      { href: "/sinapse/documentos", label: "Documentos", icon: Network },
    ],
  },
  {
    title: "Consultoria",
    items: [
      { href: "/diagnostico", label: "Diagnostico", icon: ClipboardCheck },
      { href: "/comando", label: "SOPs", icon: FileText },
      { href: "/comando/documentos", label: "Documentos", icon: FolderOpen },
      { href: "/comando/onboarding", label: "Onboarding", icon: ListChecks },
    ],
  },
  {
    title: "Operacao",
    items: [
      { href: "/crm", label: "CRM", icon: Users },
      { href: "/crm/reservas", label: "Reservas", icon: CalendarDays },
      { href: "/crm/pedidos", label: "Pedidos", icon: UtensilsCrossed },
      { href: "/crm/cardapio", label: "Cardapio", icon: BookOpen },
      { href: "/gamification", label: "Gamificacao", icon: Trophy },
      { href: "/training", label: "Formacao", icon: GraduationCap },
    ],
  },
  {
    title: "Inteligencia",
    items: [
      { href: "/clones", label: "Clones", icon: Bot },
      { href: "/automacoes", label: "Automacoes", icon: Zap },
    ],
  },
  {
    title: "Crescimento",
    items: [
      { href: "/receitas", label: "Receitas", icon: TrendingUp },
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    ],
  },
];

const roleLabel: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Gerente",
  staff: "Equipa",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const tenantTheme = useTenantTheme();

  const user = session?.user;
  const role = user?.role;
  const tenantName = user?.tenantName;
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
      {/* Brand */}
      <div
        className="p-5 border-b-2"
        style={{ borderBottomColor: "var(--tenant-primary, transparent)" }}
      >
        <div className="flex items-center gap-3">
          {tenantTheme.logo ? (
            <div
              className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-contain bg-center bg-no-repeat"
              role="img"
              aria-label={tenantTheme.name}
              style={{ backgroundImage: `url(${tenantTheme.logo})` }}
            />
          ) : (
            <div className="bg-primary/10 p-2 rounded-lg">
              <Brain className="w-6 h-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">Nexial Rede Neural</h1>
            {tenantName && <p className="text-xs text-muted-foreground truncate">{tenantName}</p>}
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>
      </div>

      <Separator />

      {/* Tenant Switcher */}
      <div className="px-3 py-2">
        <TenantSwitcher />
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {navSections.map((section) => {
          // Inject Admin link in "Plataforma" section for owners
          const items =
            section.title === "Plataforma" && role === "owner"
              ? [...section.items, { href: "/admin", label: "Admin", icon: ShieldCheck }]
              : section.items;

          return (
            <div key={section.title} className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Settings */}
        <div className="mt-2 pt-2 border-t border-border">
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/settings"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname.startsWith("/settings")
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Settings className="w-4 h-4" />
                Configuracoes
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <Separator />

      {/* User */}
      <div className="p-3">
        {status === "loading" ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-2 px-2">
              {role && (
                <Badge variant="secondary" className="text-xs">
                  {roleLabel[role] || role}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
