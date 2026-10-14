"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { recallAutoRoutedReport } from "@/app/actions/recall";
import { callAction } from "@/lib/callAction";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { closesRecallDialog, localMarkAfter, recallToastTone } from "@/lib/recall";
import type { RecallMark } from "./recallView";

/**
 * The Recall screen's page-wide state (RECALL-UI spec section 6): one dialog
 * owned by the queue page, above the strip, the table and the drawer, keyed
 * by report id. The strip, a row and the drawer only ask for it to open.
 *
 * Outside the provider (any page but the queue) `available` is false, so
 * nothing offers a recall: fail closed.
 */
interface RecallContextValue {
  // The page's probe found the recall functions, and no answer since has
  // said they are missing.
  available: boolean;
  // What the server already answered for a report this page load (spec
  // section 8): after_dispatch -> dispatched, after_window -> closed.
  marks: Readonly<Record<string, RecallMark>>;
  // The report whose dialog is open, or null.
  openFor: string | null;
  isPending: boolean;
  open: (reportId: string) => void;
  cancel: () => void;
  recall: (severity: string, reason: string) => void;
}

const RecallContext = createContext<RecallContextValue>({
  available: false,
  marks: {},
  openFor: null,
  isPending: false,
  open: () => undefined,
  cancel: () => undefined,
  recall: () => undefined,
});

export function useRecall(): RecallContextValue {
  return useContext(RecallContext);
}

export function RecallProvider({ available: serverAvailable, children }: { available: boolean; children: React.ReactNode }) {
  const { showToast } = useToast();
  const t = useT();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, RecallMark>>({});
  const [missing, setMissing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const available = serverAvailable && !missing;

  const recall = useCallback(
    (severity: string, reason: string) => {
      const reportId = openFor;
      if (!reportId) return;
      startTransition(async () => {
        const answer = await callAction(() => recallAutoRoutedReport(reportId, severity, reason));
        if (answer === null) {
          // A recall may have landed before the connection failed: never
          // guess which way it went. The dialog stays, with the text.
          showToast(t("common.noAnswer"), "danger");
          return;
        }
        const { outcome } = answer;
        const mark = localMarkAfter(outcome);
        if (mark) setMarks((prev) => ({ ...prev, [reportId]: mark }));
        if (outcome === "unavailable") setMissing(true);
        if (closesRecallDialog(outcome)) setOpenFor(null);
        showToast(t(`recall.result.${outcome}`, { id: reportId }), recallToastTone(outcome));
      });
    },
    [openFor, showToast, t]
  );

  const value = useMemo<RecallContextValue>(
    () => ({
      available,
      marks,
      openFor,
      isPending,
      open: (reportId: string) => {
        if (available) setOpenFor(reportId);
      },
      // Not while saving: the answer must reach the official.
      cancel: () => {
        if (!isPending) setOpenFor(null);
      },
      recall,
    }),
    [available, marks, openFor, isPending, recall]
  );

  return <RecallContext.Provider value={value}>{children}</RecallContext.Provider>;
}
