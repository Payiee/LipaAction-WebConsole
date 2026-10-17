"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { beginTwoStepSetup, submitTwoStepCode } from "@/app/actions/twoStep";
import { signOut } from "@/app/actions/auth";
import { callAction } from "@/lib/callAction";
import type { TwoStepOutcome } from "@/lib/twoStep";

// Fixed copy for every way an attempt can end. English like the sign-in page
// this continues: both sit outside the console's language switch.
const MESSAGES: Record<Exclude<TwoStepOutcome, "done" | "already-set-up">, string> = {
  "invalid-code": "Enter the 6-digit code your authenticator app is showing.",
  "wrong-code":
    "That code didn't match. Codes change every 30 seconds: enter the one the app shows now. If it keeps failing, check that the phone's clock is set automatically.",
  "too-many": "Too many attempts. Wait a few minutes, then try again.",
  "no-setup": "Set-up hasn't been started in this session. Reload the page and start again.",
  unavailable: "Two-step sign-in isn't switched on for this system yet. Tell the system's administrator.",
  refused: "Two-step sign-in is for city accounts only.",
  "session-expired": "Your session expired. Sign out below, then sign in again.",
  unreachable: "Couldn't reach the sign-in service. Check your connection, then try again.",
  failed: "Something went wrong. Try again in a moment.",
};
const NO_ANSWER = "Couldn't confirm that went through. Reload the page before trying again.";
// During set-up a reload would throw away the QR code and key on screen,
// and sending the code again is safe either way.
const NO_ANSWER_SETUP = "Couldn't confirm that went through. Enter the app's current code and try again.";

/** The set-up key in groups of four, as authenticator apps show it. */
function grouped(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * The second step of a city account's sign-in: an authenticator app's
 * six-digit code. An account without an authenticator sets one up here
 * first, once.
 *
 * Standing alone like the sign-in page, not inside the console's shell: the
 * session can't open any city page yet, so a sidebar of links would be a
 * sidebar of redirects back here.
 */
export function TwoStepForm({ email, hasAuthenticator }: { email: string | null; hasAuthenticator: boolean }) {
  const [setup, setSetup] = useState<{ qr: string | null; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // True when the last error was about the code itself, so the field is
  // marked invalid for that and not for a lost connection.
  const [codeRejected, setCodeRejected] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  // Kept after a correct code, while the browser moves on, so the button
  // can't be pressed twice.
  const [finished, setFinished] = useState(false);
  const showCodeField = hasAuthenticator || setup !== null;
  const busy = isPending || finished;

  function handleBegin() {
    setError(null);
    startTransition(async () => {
      const result = await callAction(beginTwoStepSetup);
      if (result === null) setError(NO_ANSWER);
      else if (result.ok) setSetup({ qr: result.qr, secret: result.secret });
      // Set up meanwhile, in another tab: reload onto the code step.
      else if (result.outcome === "already-set-up") window.location.reload();
      else setError(MESSAGES[result.outcome]);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCodeRejected(false);
    startTransition(async () => {
      const outcome = await callAction(() => submitTwoStepCode(code));
      if (outcome === null) setError(setup ? NO_ANSWER_SETUP : NO_ANSWER);
      else if (outcome === "done") {
        setFinished(true);
        // A full navigation, so the city pages are rendered against the
        // session cookie this answer has just replaced; and a replacement,
        // so Back can't return to a page that showed the set-up key.
        window.location.replace("/city");
      } else if (outcome === "already-set-up") window.location.reload();
      else {
        setError(MESSAGES[outcome]);
        setCodeRejected(outcome === "wrong-code" || outcome === "invalid-code");
        setCode("");
        // Back to the field, ready for the next code.
        codeInput.current?.focus();
      }
    });
  }

  return (
    // main, with the id the layout's skip link points at.
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-card border border-ink-100 bg-white p-6 shadow-panel">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white">
            L
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900">LipaAction</p>
            <p className="text-xs text-ink-500">City console</p>
          </div>
        </div>

        <h1 className="mb-1 text-sm font-semibold text-ink-900">Two-step sign-in</h1>

        {!showCodeField ? (
          <>
            <p className="mb-2 text-xs text-ink-700">
              City accounts sign in with a second step: after the emailed code, a 6-digit code from an authenticator
              app on your phone.
            </p>
            <p className="mb-4 text-xs text-ink-500">
              You set this up once. Install an authenticator app first if you don&apos;t have one (Google
              Authenticator and Microsoft Authenticator both work), then start.
            </p>
            <Button variant="primary" className="w-full justify-center" disabled={busy} onClick={handleBegin}>
              {isPending ? "Preparing…" : "Set up two-step sign-in"}
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {setup ? (
              <ol className="mb-3 list-decimal space-y-3 pl-4 text-xs text-ink-700">
                <li>
                  In your authenticator app, add an account and scan this code.
                  {setup.qr && (
                    // A data: address built from the Auth server's SVG; next/image has nothing to optimise in it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={setup.qr}
                      alt="QR code for your authenticator app"
                      width={176}
                      height={176}
                      className="mx-auto mt-2 h-44 w-44 rounded-md border border-ink-100 bg-white p-1"
                    />
                  )}
                  <span className="mt-2 block text-ink-500">
                    {setup.qr ? "Can't scan it? Type this key into the app instead:" : "Type this key into the app:"}
                  </span>
                  <code className="mt-1 block select-all break-all rounded-md bg-ink-50 px-2 py-1.5 font-mono text-xs text-ink-900">
                    {grouped(setup.secret)}
                  </code>
                  <span className="mt-2 block text-ink-500">
                    Started this before? Remove any earlier LipaAction entry from the app first: its codes no
                    longer match.
                  </span>
                </li>
                <li>Enter the 6-digit code the app now shows for LipaAction.</li>
              </ol>
            ) : (
              <p className="mb-3 text-xs text-ink-700">
                Enter the 6-digit code your authenticator app shows for LipaAction.
              </p>
            )}

            <label className="mb-1.5 block text-xs font-medium text-ink-700" htmlFor="two-step-code">
              Authenticator code
            </label>
            <input
              id="two-step-code"
              ref={codeInput}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              maxLength={7}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              aria-invalid={codeRejected}
              aria-describedby={error ? "two-step-error" : undefined}
              placeholder="6-digit code"
              className="mb-3 min-h-11 w-full rounded-md border border-ink-100 bg-ink-50 px-3 text-center text-lg tracking-widest text-ink-900 placeholder:text-sm placeholder:tracking-normal placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
            />
            <Button
              variant="primary"
              type="submit"
              className="w-full justify-center"
              disabled={busy || code.replace(/\s/g, "").length < 6}
            >
              {busy ? "Checking…" : setup ? "Finish set-up" : "Continue"}
            </Button>
            {!setup && (
              <p className="mt-3 text-xs text-ink-500">
                Lost the phone with your authenticator app? Ask the system&apos;s administrator to reset two-step
                sign-in for your account.
              </p>
            )}
          </form>
        )}

        {/* Always in the page, so a screen reader hears an error the moment it appears. */}
        <p id="two-step-error" role="alert" className="mt-3 text-xs text-priority-critical">
          {error}
        </p>

        <div className="mt-2 border-t border-ink-100 pt-3 text-center">
          {email && <p className="text-xs text-ink-500">Signed in as {email}</p>}
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-xs font-medium text-brand-600 hover:underline"
            >
              Sign out and use a different account
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
