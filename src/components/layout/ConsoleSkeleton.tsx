/**
 * Placeholder chrome shown while a gated page's server work is in flight.
 *
 * Every console route is force-dynamic and does two sequential awaits — the
 * auth gate, then the data query — before it can render anything. Without a
 * loading state the click registers and the screen simply sits there, which
 * reads as a broken link rather than as work in progress.
 *
 * It mirrors AppShell's geometry (w-60 sidebar, bordered top bar) so the real
 * page settles into the same layout instead of jumping. It cannot render
 * AppShell itself: AppShell needs an OfficialProfile, and at this point the
 * auth gate that produces one hasn't run yet.
 */
export function ConsoleSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50" aria-busy="true">
      <div className="hidden w-60 shrink-0 flex-col gap-2 border-r border-ink-100 bg-white p-4 lg:flex">
        <div className="mb-4 h-9 w-32 animate-pulse rounded-md bg-ink-100" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded-md bg-ink-50" />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-[65px] items-center justify-between border-b border-ink-100 bg-white px-4 py-2 sm:px-6">
          <div className="h-5 w-40 animate-pulse rounded bg-ink-100" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-ink-100" />
        </div>

        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-6 flex flex-wrap gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[84px] w-36 animate-pulse rounded-card bg-white" />
            ))}
          </div>
          <div className="h-64 w-full animate-pulse rounded-card bg-white" />
          {/* Announced politely so a screen reader isn't interrupted mid-sentence
              by a state that resolves on its own. */}
          <p className="sr-only" role="status">
            Loading
          </p>
        </div>
      </div>
    </div>
  );
}
