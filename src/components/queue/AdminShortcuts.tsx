"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { isSeniorBarangayAdminRole } from "@/lib/roles";

/**
 * The barangay admin's shortcuts (thesis A.3.1): Verify Resident and
 * Sanctions for both admin roles, and the senior admin's Revoke Attestation,
 * which opens Verify Resident on its verified residents. Below the queue,
 * like the recent-activity list, so neither sits between an official and the
 * reports waiting for a decision. The sidebar carries the same pages for
 * every visit that doesn't start here.
 */
export function AdminShortcuts({ role }: { role: string }) {
  const t = useT();
  return (
    <nav aria-label={t("queue.shortcuts.title")} className="mt-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {t("queue.shortcuts.title")}
      </span>
      <Link href="/verify-resident" className={buttonClassName("secondary", "sm")}>
        {t("nav.verifyResident")}
      </Link>
      <Link href="/sanctions" className={buttonClassName("secondary", "sm")}>
        {t("nav.sanctions")}
      </Link>
      {isSeniorBarangayAdminRole(role) && (
        // Red-tinted, as the thesis draws it: revoking undoes another
        // official's attestation.
        <Link href="/verify-resident?tier=tier1" className={buttonClassName("danger", "sm")}>
          {t("queue.shortcuts.revoke")}
        </Link>
      )}
    </nav>
  );
}
