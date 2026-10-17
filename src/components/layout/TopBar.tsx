import { ProfileMenu } from "./ProfileMenu";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { usePreferences, type InterfaceLanguage } from "@/lib/preferences";
import type { ConsoleRole, ConsoleUser } from "@/lib/auth";

export interface TopBarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

// Each language is named in itself, with its own lang attribute, so a screen
// reader announces [Tagalog] correctly while the page is in English and the
// reverse. The visible codes are the paper's (A.3, top-right EN/TL switch).
const LANGUAGES: { value: InterfaceLanguage; code: string; name: string }[] = [
  { value: "en", code: "EN", name: "English" },
  { value: "tl", code: "TL", name: "Tagalog" },
];

/**
 * The same preference as Settings → Language, from the shared store, so the
 * two can never disagree. Disabled until hydration: before then the server's
 * role default is on screen, and a click could land on a value about to be
 * replaced by the stored one.
 */
function LanguageSwitch({ role }: { role: ConsoleRole }) {
  const { prefs, update, hydrated } = usePreferences(role);
  const t = useT();

  return (
    <div
      role="group"
      aria-label={t("shell.language")}
      className="inline-flex shrink-0 rounded-md border border-ink-100 bg-ink-50 p-0.5"
    >
      {LANGUAGES.map((option) => {
        const active = prefs.interfaceLanguage === option.value;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.value}
            aria-label={option.name}
            aria-pressed={active}
            disabled={!hydrated}
            onClick={() => update({ interfaceLanguage: option.value })}
            className={cx(
              "h-11 min-w-11 rounded px-2.5 text-xs font-semibold transition-colors disabled:opacity-60",
              active ? "bg-white text-brand-700 shadow-panel" : "text-ink-500 hover:text-ink-900"
            )}
          >
            {option.code}
          </button>
        );
      })}
    </div>
  );
}

export function TopBar({
  breadcrumb,
  actions,
  official,
  search,
  onMenuClick,
}: {
  breadcrumb: string[];
  actions?: React.ReactNode;
  official: ConsoleUser;
  // Omitted by pages that don't filter. The box used to render everywhere
  // while being wired to nothing — a permanently dead input on five pages.
  search?: TopBarSearch;
  onMenuClick?: () => void;
}) {
  const t = useT();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-2 sm:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={t("shell.openMenu")}
          className="flex h-11 w-11 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100 lg:hidden"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <nav className="flex min-w-0 items-center gap-1.5 truncate text-sm text-ink-500" aria-label={t("shell.breadcrumb")}>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              <span className={i === breadcrumb.length - 1 ? "font-medium text-ink-900" : ""}>
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* The search box takes the room the top bar has spare, up to a
          comfortable reading width, so a long category or description fits
          as it is typed. */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {search && (
          <label className="hidden min-w-0 max-w-xl flex-1 items-center gap-2 rounded-md border border-ink-100 bg-ink-50 px-3 text-sm text-ink-500 focus-within:border-brand-500 focus-within:bg-white md:flex">
            <Icon name="search" className="h-4 w-4" />
            <span className="sr-only">{search.label}</span>
            <input
              type="search"
              aria-label={search.label}
              placeholder={search.placeholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              className="min-h-11 w-full min-w-0 bg-transparent text-sm text-ink-700 placeholder:text-ink-500 focus:outline-none"
            />
          </label>
        )}
        {actions}
        <LanguageSwitch role={official.role} />
        <ProfileMenu official={official} />
      </div>
    </header>
  );
}
