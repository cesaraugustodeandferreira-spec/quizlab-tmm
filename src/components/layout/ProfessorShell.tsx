"use client";

import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  IconBooks,
  IconChartBar,
  IconLayoutDashboard,
  IconListDetails,
  IconLogout,
  IconSchool,
  IconUser,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

const NAV = [
  { href: "/professor/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/professor/turmas", label: "Minhas Turmas", icon: IconSchool },
  { href: "/professor/quizzes", label: "Quizzes", icon: IconListDetails },
  { href: "/professor/biblioteca", label: "Biblioteca", icon: IconBooks },
  { href: "/professor/diagnosticos", label: "Diagnósticos", icon: IconChartBar },
  { href: "/professor/perfil", label: "Perfil", icon: IconUser },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderState {
  breadcrumb?: BreadcrumbItem[];
  pill?: string | null;
}

const HeaderContext = createContext<(state: HeaderState | null) => void>(() => {});

export function usePageHeader(state: HeaderState) {
  const set = useContext(HeaderContext);
  const key = JSON.stringify(state);
  useEffect(() => {
    set(JSON.parse(key));
    return () => set(null);
  }, [key, set]);
}

export function ProfessorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [header, setHeader] = useState<HeaderState | null>(null);

  return (
    <HeaderContext.Provider value={setHeader}>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-2.5 bottom-2.5 z-40 flex items-center justify-between overflow-x-auto rounded-[14px] border border-line bg-surface px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:hidden"
      >
        {NAV.slice(0, 6).map((item) => (
          <RailLink key={item.href} {...item} pathname={pathname!} compact />
        ))}
      </nav>

      <div className="flex min-h-dvh">
        <nav
          aria-label="Navegação principal"
          className="sticky top-0 hidden h-dvh w-14 shrink-0 flex-col items-center justify-between border-r border-line bg-surface py-3 sm:flex"
        >
          <div className="flex w-full flex-col items-center gap-1">
            <Link
              href="/professor/dashboard"
              aria-label="Início"
              className="mb-3 flex size-9 items-center justify-center rounded-xl bg-accent text-white transition-transform hover:scale-105"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 3h6l-.7 5.364a4 4 0 0 0 .4 2.34l3.3 6.296a2 2 0 0 1-1.772 2.93H5.772a2 2 0 0 1-1.772-2.93l3.3-6.296a4 4 0 0 0 .4-2.34L7 3z" />
                <path d="M6.5 15h11" />
              </svg>
            </Link>
            {NAV.map((item) => (
              <RailLink key={item.href} {...item} pathname={pathname!} />
            ))}
          </div>
          <button
            onClick={() => void signOut()}
            title="Sair da conta"
            aria-label="Sair da conta"
            className="rounded-lg p-2.5 text-faint transition-colors hover:bg-bad-deep hover:text-bad"
          >
            <IconLogout size={19} stroke={1.8} />
          </button>
        </nav>

        <div className="flex-1 min-w-0 p-2.5 sm:p-3">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-2">
            <Breadcrumb items={header?.breadcrumb ?? []} />
            <div className="flex items-center gap-3">
              {header?.pill && (
                <span className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-mute md:inline-flex">
                  {header.pill}
                </span>
              )}
              <div className="flex items-center gap-2.5">
                <Avatar name={profile?.full_name ?? "?"} />
                <div className="hidden leading-tight lg:block">
                  <p className="text-sm font-medium text-ink">{profile?.full_name}</p>
                  <p className="text-xs text-faint">Professor</p>
                </div>
              </div>
            </div>
          </header>
          <main className="pb-28 sm:pb-12">{children}</main>
        </div>
      </div>
    </HeaderContext.Provider>
  );
}

function RailLink({
  href,
  label,
  icon: Icon,
  pathname,
  compact = false,
}: {
  href: string;
  label: string;
  icon: typeof IconSchool;
  pathname: string;
  compact?: boolean;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl transition-all duration-150",
        compact ? "size-11" : "size-10",
        active
          ? "bg-accent-deep text-accent-bright ring-1 ring-accent/25"
          : "text-faint hover:bg-surface-2 hover:text-mute",
      )}
    >
      <Icon size={compact ? 21 : 19} stroke={active ? 2 : 1.8} />
    </Link>
  );
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return <div className="h-6" />;
  return (
    <nav aria-label="Trilha de navegação" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-faint">/</span>}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="truncate text-faint transition-colors hover:text-mute">
              {item.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
