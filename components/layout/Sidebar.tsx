"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { editorHomePath, isEditor, navHrefsForRole, roleLabel } from "@/lib/auth/roles";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { gruposNavParaRol, navItemActivo } from "./nav-items";

const STORAGE = "crm-sidebar-collapsed";

export function Sidebar({ badges }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const permitidos = navHrefsForRole(user?.role, "desktop");
  const grupos = gruposNavParaRol(user?.role, permitidos);
  const home = isEditor(user?.role) ? editorHomePath() : "/";

  return (
    <aside
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-white transition-[width] duration-200 min-[820px]:flex"
      style={{ width: collapsed ? 62 : 232 }}
    >
      <Link
        href={home}
        className={cn("flex h-14 items-center overflow-hidden", collapsed ? "justify-center px-2" : "px-3")}
        aria-label="Inicio"
      >
        {collapsed ? (
          <img src="/images/icono.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
        ) : (
          <img src="/images/logo-web.png" alt="" className="h-8 w-auto max-w-full shrink-0 object-contain" />
        )}
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        {grupos.map((grupo) => (
          <div key={grupo.label} className="mb-2.5">
            {!collapsed && (
              <div className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-medium uppercase tracking-[0.09em] text-[var(--label)]">
                {grupo.label}
              </div>
            )}
            {grupo.items.map(({ href, label, icon: Icon }) => {
              const on = navItemActivo(pathname, href);
              const badge = badges?.[href];
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    "flex min-h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] whitespace-nowrap",
                    on ? "bg-accent-soft font-semibold text-accent" : "font-medium text-[#3B4744] hover:bg-[var(--surface-soft)]"
                  )}
                >
                  <Icon size={17} strokeWidth={1.9} className="shrink-0" />
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
                  {!collapsed && badge ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[11px] font-semibold",
                        on ? "bg-accent text-white" : "bg-[#F2F1EC] text-[var(--text-2)]"
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2.5 border-t border-[var(--border-soft)] px-2 py-2.5">
        <Link
          href="/settings"
          className={cn(
            "flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-[9px] px-1.5",
            navItemActivo(pathname, "/settings") ? "bg-accent-soft text-accent" : "hover:bg-[var(--surface-soft)]"
          )}
        >
          {collapsed ? (
            <Settings size={17} strokeWidth={1.9} />
          ) : (
            <>
              <AvatarComercial
                nombre={user?.nombre}
                email={user?.email}
                color={user?.color}
                size={30}
              />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-semibold">{user?.nombre || user?.email}</span>
                <span className="block text-[11.5px] text-[var(--text-2)]">{roleLabel(user?.role)}</span>
              </span>
            </>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Plegar menú"}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
