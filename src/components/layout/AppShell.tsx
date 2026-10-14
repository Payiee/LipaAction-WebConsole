"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar, type TopBarSearch } from "./TopBar";
import { CityAlerts } from "@/components/city/CityAlerts";
import { useT } from "@/lib/i18n";
import type { ConsoleUser } from "@/lib/auth";

export function AppShell({
  breadcrumb,
  actions,
  official,
  search,
  children,
}: {
  breadcrumb: string[];
  actions?: React.ReactNode;
  // A barangay official or a city account; the sidebar picks its links
  // and the scope line from which one it is.
  official: ConsoleUser;
  search?: TopBarSearch;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const t = useT();

  return (
    // print: the console's chrome stays off paper, and the content area stops
    // being a fixed-height scroll box, so a printed report isn't cut off at
    // the screen's height.
    <div className="flex h-screen w-full overflow-hidden bg-ink-50 print:block print:h-auto print:overflow-visible print:bg-white">
      {/* The city dashboard's sound alerts play on every city page. */}
      {!("barangayName" in official) && <CityAlerts role={official.role} />}
      {/* Desktop sidebar */}
      <div className="hidden lg:block print:hidden">
        <Sidebar official={official} />
      </div>

      {/* Mobile off-canvas sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <button
            aria-label={t("shell.closeMenu")}
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-50 h-full">
            <Sidebar official={official} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <TopBar
          breadcrumb={breadcrumb}
          actions={actions}
          official={official}
          search={search}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        {/* relative: the page's scroll area must also be the box that
            absolutely positioned content (every sr-only label) is placed in.
            Without it, a label far down a long list was placed against the
            whole document instead, escaped this area's clipping and gave the
            page a second scrollbar onto blank space below the shell. */}
        <main id="main-content" className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
