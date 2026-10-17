"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonClassName } from "@/components/ui/Button";

/**
 * What an official sees when a console page throws.
 *
 * Deliberately does not print error.message. These pages talk to Supabase, so
 * a raw message can carry table names, column names, or policy details — of no
 * use to a barangay secretary and not worth putting on screen. The digest is
 * shown instead: it's the handle that ties this screen to the server log.
 *
 * Note this only catches unexpected throws. A failed data query does NOT land
 * here — src/lib/data/* fails closed and returns an empty result, so a broken
 * query renders as an empty page rather than an error.
 */
export function ErrorState({
  pageName,
  error,
  reset,
}: {
  pageName: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    // Server-side throws are already logged by the host; this covers the
    // client half so a browser-only failure isn't invisible.
    console.error(`[${pageName}]`, error);
  }, [pageName, error]);

  // reset() on its own only re-renders what the browser already holds, and
  // after a server-side throw that is the failed render: Try again sent no
  // request and put the same error back, even once the cause had cleared.
  // refresh() asks the server for the page again, and reset() in the same
  // transition swaps this screen out only when the new render arrives. If
  // the server is still failing, this screen comes back with a new reference.
  function retry() {
    startRetry(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md rounded-card border border-ink-100 bg-white p-6 text-center shadow-panel">
        <p className="mb-1 text-sm font-semibold text-ink-900">{pageName} couldn&apos;t load</p>
        <p className="mb-5 text-xs text-ink-500">
          Something went wrong on our side. Your reports and validations are unaffected —
          nothing was changed by this error.
        </p>

        <div className="flex justify-center gap-2">
          <Button variant="primary" size="sm" onClick={retry} disabled={retrying}>
            {retrying ? "Trying again…" : "Try again"}
          </Button>
          <Link href="/queue" className={buttonClassName("secondary", "sm")}>
            Back to Queue
          </Link>
        </div>

        {error.digest && (
          <p className="mt-5 font-mono text-xs text-ink-500">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
