"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ROLE_LABELS } from "@/components/audit-log/AuditTable";
import { useT, type MessageKey } from "@/lib/i18n";
import { ownValue } from "@/lib/utils";
import type { ResidentTierFilter } from "@/lib/residents";
// Type-only import from a server-only module — erased at compile time.
import type { ResidentRow } from "@/lib/data/residents";
import { residentWho } from "./who";
import { EmptyState } from "@/components/ui/EmptyState";

// The backend's method values. A lookup with a raw-text fallback, never a
// closed union: a value this console doesn't know is shown as itself.
const METHOD_LABELS: Record<string, MessageKey> = {
  in_person: "verify.method.in_person",
  field: "verify.method.field",
  bulk_import: "verify.method.bulk_import",
};

const EMPTY_BODY: Record<ResidentTierFilter, MessageKey> = {
  tier0: "verify.empty.tier0",
  tier1: "verify.empty.tier1",
  all: "verify.empty.all",
};

export function ResidentTable({
  residents,
  tier,
  query,
  loadFailed,
  detailsUnavailable,
  canRevoke,
  onVerify,
  onRevoke,
}: {
  residents: ResidentRow[];
  tier: ResidentTierFilter;
  query: string;
  // The list couldn't be read: the banner above says so, and no empty
  // sentence is printed under it as if the barangay had nobody to show.
  loadFailed: boolean;
  // The attestation rows couldn't be read: a row then says nothing about
  // its verification, where [Not verified] would be a claim.
  detailsUnavailable: boolean;
  // senior_barangay_admin only; the backend refuses anyone else.
  canRevoke: boolean;
  onVerify: (resident: ResidentRow) => void;
  onRevoke: (resident: ResidentRow) => void;
}) {
  const t = useT();

  if (residents.length === 0) {
    if (loadFailed) return null;
    return (
      <EmptyState icon="verify">
        <p className="text-sm font-medium text-ink-700">{t("verify.empty.title")}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
          {query.length > 0 ? t("verify.empty.search", { query }) : t(EMPTY_BODY[tier])}
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">{t("verify.caption")}</caption>
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("verify.col.resident")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("verify.col.tier")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("verify.col.verification")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("verify.col.action")}</th>
          </tr>
        </thead>
        <tbody>
          {residents.map((resident) => {
            const name = resident.name ?? t("verify.unnamed");
            const verification = resident.verification;
            const method = verification ? ownValue(METHOD_LABELS, verification.method) : undefined;
            const role = verification?.attestedRole ? ownValue(ROLE_LABELS, verification.attestedRole) : undefined;
            const roleText = verification?.attestedRole ? (role ? t(role) : verification.attestedRole) : null;
            return (
              <tr key={resident.id} className="border-b border-ink-100 align-top last:border-0 hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-ink-900">{name}</p>
                  {resident.phoneEnding && (
                    <p className="mt-0.5 text-xs text-ink-500">
                      {t("verify.phoneEnding", { digits: resident.phoneEnding })}
                    </p>
                  )}
                  {resident.registeredOn && (
                    <p className="text-xs text-ink-500">{t("verify.registered", { date: resident.registeredOn })}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {resident.tier === "tier1" ? (
                    <Badge tone="success">
                      {/* The icon repeats the words, so the tier is never
                          carried by the badge colour alone. */}
                      <Icon name="check" className="mr-1 h-3 w-3" />
                      {t("verify.tier.tier1")}
                    </Badge>
                  ) : resident.tier === "tier0" ? (
                    <Badge>{t("verify.tier.tier0")}</Badge>
                  ) : (
                    <span className="text-xs text-ink-700">{resident.tier}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-700">
                  {verification ? (
                    <>
                      <p>
                        {method ? t(method) : verification.method || "—"} · {verification.verifiedOn}
                      </p>
                      {(verification.attestedBy || roleText) && (
                        <p className="mt-0.5 text-xs text-ink-500">
                          {t("verify.verifiedBy", {
                            who: [verification.attestedBy, roleText].filter(Boolean).join(" · "),
                          })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-ink-500">{detailsUnavailable ? "—" : t("verify.notVerified")}</p>
                  )}
                  {resident.lastRevocation && (
                    <p className="mt-1 text-xs text-priority-medium">
                      {resident.lastRevocation.reason
                        ? t("verify.lastRevokedReason", {
                            date: resident.lastRevocation.revokedOn,
                            reason: resident.lastRevocation.reason,
                          })
                        : t("verify.lastRevoked", { date: resident.lastRevocation.revokedOn })}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {resident.tier === "tier0" ? (
                    <Button
                      variant="primary"
                      size="sm"
                      aria-label={t("verify.action.verifyLabel", { who: residentWho(resident, t) })}
                      onClick={() => onVerify(resident)}
                    >
                      {t("verify.action.verify")}
                    </Button>
                  ) : resident.tier === "tier1" ? (
                    canRevoke ? (
                      <Button
                        variant="danger"
                        size="sm"
                        aria-label={t("verify.action.revokeLabel", { whoOf: residentWho(resident, t, "of") })}
                        onClick={() => onRevoke(resident)}
                      >
                        {t("verify.action.revoke")}
                      </Button>
                    ) : (
                      <p className="max-w-[12rem] text-xs text-ink-500">{t("verify.seniorOnly")}</p>
                    )
                  ) : (
                    <span className="text-xs text-ink-500">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
