"use client";

import { LogoMark } from "@/components/ui/LogoMark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx, displayName, initials } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/ui/Icon";
import { isBarangayAdminRole } from "@/lib/roles";
import type { ConsoleUser } from "@/lib/auth";

// prefetch: false for a page whose render writes an access record, so that
// merely seeing the link can never record an opening nobody made.
type NavItem = { href: string; label: MessageKey; icon: IconName; prefetch?: false };

const primaryNav: NavItem[] = [
  { href: "/queue", label: "nav.queue", icon: "queue" },
  { href: "/cluster-explorer", label: "nav.clusterExplorer", icon: "clusters" },
];

const secondaryNav: NavItem[] = [
  { href: "/validation-history", label: "nav.validationHistory", icon: "history" },
  { href: "/reports", label: "nav.reports", icon: "reports" },
  { href: "/audit-log", label: "nav.auditLog", icon: "audit" },
];

// For barangay_admin and senior_barangay_admin only: the thesis gives Tier 1
// verification and sanction lifts to those roles (A.3). A barangay_official's
// sidebar doesn't list the pages, and they send that role back to the queue.
const residentNav: NavItem[] = [
  { href: "/verify-resident", label: "nav.verifyResident", icon: "verify" },
  { href: "/sanctions", label: "nav.sanctions", icon: "sanctions" },
];

const bottomNav: NavItem[] = [{ href: "/settings", label: "nav.settings", icon: "settings" }];

// The city dashboard's own links. None of the barangay pages appear: each is
// gated to barangay roles and would only send a city account back here.
const cityNav: NavItem[] = [
  { href: "/city", label: "nav.cityOverview", icon: "reports" },
  { href: "/city/map", label: "nav.cityMap", icon: "map" },
  { href: "/city/reports", label: "nav.cityReports", icon: "queue" },
  { href: "/city/response-times", label: "nav.cityResponse", icon: "timer" },
  { href: "/city/verification", label: "nav.cityVerification", icon: "verify" },
  { href: "/city/agencies", label: "nav.cityAgencies", icon: "agencies" },
  { href: "/city/access-log", label: "nav.cityAccessLog", icon: "audit", prefetch: false },
];

type NavGroup = { heading?: MessageKey; items: NavItem[] };

function barangayGroups(role: string): NavGroup[] {
  return [
    { items: primaryNav },
    ...(isBarangayAdminRole(role) ? [{ heading: "nav.residents" as const, items: residentNav }] : []),
    { heading: "nav.records", items: secondaryNav },
    { heading: "nav.account", items: bottomNav },
  ];
}

const CITY_GROUPS: NavGroup[] = [
  { items: cityNav },
  { heading: "nav.account", items: [{ href: "/city/settings", label: "nav.settings", icon: "settings" }] },
];

function NavLink({
  href,
  label,
  icon,
  prefetch,
  active,
  onNavigate,
}: {
  href: string;
  label: MessageKey;
  icon: IconName;
  prefetch?: false;
  active: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-brand-100 text-brand-700"
          : "text-ink-700 hover:bg-ink-100"
      )}
    >
      <Icon name={icon} />
      {t(label)}
    </Link>
  );
}

export function Sidebar({
  official,
  onNavigate,
}: {
  official: ConsoleUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const name = displayName(official.fullName);
  const t = useT();
  const isBarangay = "barangayName" in official;
  const groups = isBarangay ? barangayGroups(official.role) : CITY_GROUPS;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-ink-100 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-4">
        <LogoMark size={32} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink-900">LipaAction</p>
          <p className="text-xs text-ink-500">
            {t(isBarangay ? "shell.consoleName" : "shell.cityConsoleName")}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {groups.map((group, i) => (
          <div key={group.heading ?? i}>
            {group.heading && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {t(group.heading)}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={pathname === item.href}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-t border-ink-100 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
          {initials(name)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-semibold text-ink-900">{name}</p>
          <p className="truncate text-xs text-ink-500">
            {t(`role.${official.role}`)} · {isBarangay ? official.barangayName : t("city.scope")}
          </p>
        </div>
      </div>
    </aside>
  );
}
