"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";
import { AccessLogView } from "@/components/city/AccessLogView";
import { ReadOnlyNote } from "@/components/city/ReadOnlyNote";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import type { CityProfile } from "@/lib/auth";
// Type-only import from a server-only module — erased at compile time.
import type { AccessLogData } from "@/lib/data/cityAccessLog";
import { EmptyState } from "@/components/ui/EmptyState";

// Server renders this browser has already shown. Module scope, so it outlives
// the component: Next keeps a visited page in its router cache and shows it
// again on a return visit (back, or a link within 30 seconds) without asking
// the server, which would show the log without recording the opening. A
// render id seen before means exactly that copy, so the page asks the server
// for a fresh render, which records the opening as any other does.
const shownRenders = new Set<string>();

export function AccessLogClient({ admin, data }: { admin: CityProfile; data: AccessLogData }) {
  const t = useT();
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  // React runs this effect twice on mount in development; the ref keeps that
  // from reading as a return visit.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (handled.current === data.renderId) return;
    handled.current = data.renderId;
    if (shownRenders.has(data.renderId)) {
      router.refresh();
      return;
    }
    shownRenders.add(data.renderId);
  }, [data.renderId, router]);

  return (
    <AppShell breadcrumb={[t("city.scope"), t("nav.cityAccessLog")]} official={admin}>
      {data.logFailure !== null ? (
        // Nothing was read: the opening couldn't be recorded, and an access
        // log shown without its own record would defeat itself.
        <EmptyState icon="audit" role="alert">
          <p className="text-sm font-medium text-ink-900">{t("city.access.notRecorded.title")}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
            {t(data.logFailure === "session" ? "city.access.notRecorded.session" : "city.access.notRecorded.body")}
          </p>
          {data.logFailure === "failed" && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              disabled={retrying}
              onClick={() => startRetry(() => router.refresh())}
            >
              {t("city.access.retry")}
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          {data.loadFailed && <DataUnavailableBanner what={t("banner.what.cityAccessLog")} />}
          <ReadOnlyNote />
          <AccessLogView data={data} />
        </>
      )}
    </AppShell>
  );
}
