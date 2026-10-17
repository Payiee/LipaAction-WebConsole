"use client";

import { LogoMark } from "@/components/ui/LogoMark";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";

type Step = "email" | "code";
type Status = "idle" | "loading" | "error";

// Codes Supabase returns when an address has no account and
// shouldCreateUser is false. Treated as success on purpose — see
// handleSendCode.
const UNKNOWN_ACCOUNT_CODES = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);

function isUnknownAccount(error: AuthError): boolean {
  return error.code !== undefined && UNKNOWN_ACCOUNT_CODES.has(error.code);
}

// Loaded on first use, not with the page. supabase-js is the bulk of this
// page's JavaScript (~68 KB gzipped, plus a Buffer polyfill), and nobody
// needs it until they submit an email. Type imports above are erased, so
// they don't pull it in.
async function getSupabase() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

// Name, not isAuthRetryableFetchError(): importing that helper would pull
// supabase-js back into this page's initial bundle.
function isNetworkError(error: AuthError): boolean {
  return error.name === "AuthRetryableFetchError" || error.status === 0;
}

// Fixed copy only. error.message is the Auth server's own wording — it can
// name internals, it changes between versions, and it is what made unknown
// addresses distinguishable. Branch on error.code, with status as the only
// fallback; never on the message text.
function verifyErrorMessage(error: AuthError): string {
  if (isNetworkError(error)) return "Couldn't reach the sign-in service. Check your connection, then try again.";
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  // No separate [expired] branch: Supabase answers otp_expired for a mistyped
  // code as well as an expired one (its message is [Token has expired or is
  // invalid]), so the code can't tell them apart and neither can this copy.
  return "That code is incorrect or has expired. Check the email, or request a new code below.";
}

// For a code that was handed over, not emailed: there is no email to check,
// and asking for a new code here would cancel the one that was given.
const GIVEN_CODE_REJECTED =
  "That code is incorrect or has expired. Check it with the person who gave it to you, and that the email address above is yours.";

function sendCodeErrorMessage(error: AuthError): string {
  if (isNetworkError(error)) return "Couldn't reach the sign-in service. Check your connection, then try again.";
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429) {
    return "Too many sign-in attempts. Wait a few minutes, then try again.";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return "That doesn't look like a valid email address.";
  }
  return "Couldn't send a sign-in code right now. Try again in a moment.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // True when the official came to the code step with a code already in
  // hand, so no code was sent and the copy must not say one was.
  const [codeGiven, setCodeGiven] = useState(false);
  const emailForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback_failed") {
      setStatus("error");
      setErrorMessage("That sign-in link is invalid or expired. Request a new code below.");
    }
  }, [searchParams]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    // The client loads on demand; offline, that load itself can fail, and an
    // uncaught rejection here left the button stuck on its loading label.
    let supabase: Awaited<ReturnType<typeof getSupabase>>;
    try {
      supabase = await getSupabase();
    } catch {
      setStatus("error");
      setErrorMessage("Couldn’t reach the sign-in service. Check your connection, then try again.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Only pre-provisioned accounts can sign in — a barangay/agency
        // official's account must already exist (created by an admin in
        // Supabase Studio). Without this, ANY email typed here would
        // auto-create a brand new account.
        shouldCreateUser: false,
        // Still set, as a fallback: if the person clicks the link in the
        // email instead of typing the code, it still works via the existing
        // /auth/callback route. The code entry below is just the primary,
        // faster path — no second tab required.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error && !isUnknownAccount(error)) {
      setStatus("error");
      setErrorMessage(sendCodeErrorMessage(error));
      return;
    }

    // An address with no console account advances too, deliberately. With
    // shouldCreateUser: false, Supabase refuses unknown addresses — and
    // showing that refusal told anyone typing into this public form which
    // emails belong to LipaAction officials. The code step's copy says a code
    // is on its way only if the address has an account.
    setCodeGiven(false);
    setStatus("idle");
    setStep("code");
  }

  // Straight to the code step, sending nothing. An administrator can make a
  // sign-in code on the server and hand it to an official whose address the
  // email service cannot reach. Requesting a code here first would fail for
  // such an address, and would cancel the code that was handed over.
  function handleHaveCode() {
    // The browser's own check of the email box, with its own message.
    if (emailForm.current && !emailForm.current.reportValidity()) return;
    setCodeGiven(true);
    setStatus("idle");
    setErrorMessage("");
    setStep("code");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    // The client loads on demand; offline, that load itself can fail, and an
    // uncaught rejection here left the button stuck on its loading label.
    let supabase: Awaited<ReturnType<typeof getSupabase>>;
    try {
      supabase = await getSupabase();
    } catch {
      setStatus("error");
      setErrorMessage("Couldn’t reach the sign-in service. Check your connection, then try again.");
      return;
    }
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setStatus("error");
      // Every failure used to read [incorrect] — including a dropped
      // connection or a rate limit, which sent officials retyping a code that
      // was right all along.
      // otp_expired is the answer to a wrong code and an expired one alike.
      setErrorMessage(codeGiven && error.code === "otp_expired" ? GIVEN_CODE_REJECTED : verifyErrorMessage(error));
      return;
    }

    // Full navigation (not client-side router.push) so the server picks up
    // the freshly-set session cookie on the very next request — avoids any
    // race between the cookie write and the RSC navigation to a
    // force-dynamic, auth-gated page. No router.refresh() first: it started
    // a full server render of /login that this navigation immediately threw
    // away.
    window.location.href = "/queue";
  }

  function handleResend() {
    setCode("");
    setStatus("idle");
    setErrorMessage("");
    setStep("email");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm rounded-card border border-ink-100 bg-white p-6 shadow-panel">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark size={36} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900">LipaAction</p>
            <p className="text-xs text-ink-500">Barangay console</p>
          </div>
        </div>

        {step === "email" && (
          <form ref={emailForm} onSubmit={handleSendCode}>
            <label className="mb-1.5 block text-xs font-medium text-ink-700" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@lipa.gov.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={status === "error"}
              aria-describedby={status === "error" ? "email-error" : undefined}
              className="mb-3 min-h-11 w-full rounded-md border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
            />

            {/* An alert, so a screen reader announces it: a plain paragraph
                appeared silently, and an official who can't see the screen
                heard nothing after a failed attempt (found testing a wrong
                code on 2026-09-22). */}
            {status === "error" && (
              <p id="email-error" role="alert" className="mb-3 text-xs text-priority-critical">
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={status === "loading"}
              className="w-full justify-center"
            >
              {status === "loading" ? "Sending code…" : "Send sign-in code"}
            </Button>

            <button
              type="button"
              onClick={handleHaveCode}
              disabled={status === "loading"}
              className="mt-2 flex min-h-11 w-full items-center justify-center text-xs font-medium text-brand-600 hover:underline"
            >
              I already have a code
            </button>

            <p className="mt-4 text-center text-xs text-ink-500">
              For barangay officials and city administrators only. Agency staff use the agency
              console, and residents use the LipaAction mobile app.
            </p>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode}>
            {/* No digit count in this copy on purpose. The OTP length is a
                Supabase project Auth setting, not something this repo
                controls — it emits 8 digits today, and the [6-digit]
                inherited from the mockup contradicted what officials
                actually received.

                Worded conditionally on purpose: this step is reached for
                every address, known or not, so the page can't be used to
                test which emails belong to officials. */}
            {codeGiven ? (
              <p className="mb-3 text-xs text-ink-500">
                Signing in as <span className="font-medium text-ink-700">{email}</span>. Type the code you were
                given. No new code is sent.
              </p>
            ) : (
              <p className="mb-3 text-xs text-ink-500">
                If <span className="font-medium text-ink-700">{email}</span> has a console account,
                a sign-in code is on its way. Type the code here — you don&apos;t need to click the link in the email.
              </p>
            )}

            <label className="mb-1.5 block text-xs font-medium text-ink-700" htmlFor="code">
              Sign-in code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder={codeGiven ? "Enter the code you were given" : "Enter the code from your email"}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-invalid={status === "error"}
              aria-describedby={status === "error" ? "code-error" : undefined}
              className="mb-3 min-h-11 w-full rounded-md border border-ink-100 bg-ink-50 px-3 text-center text-lg tracking-widest text-ink-900 placeholder:text-sm placeholder:tracking-normal placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
            />

            {status === "error" && (
              <p id="code-error" role="alert" className="mb-3 text-xs text-priority-critical">
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={status === "loading" || code.length < 6}
              className="w-full justify-center"
            >
              {status === "loading" ? "Verifying…" : "Verify and sign in"}
            </Button>

            <button
              type="button"
              onClick={handleResend}
              className="mt-2 flex min-h-11 w-full items-center justify-center text-xs font-medium text-brand-600 hover:underline"
            >
              {codeGiven ? "Use a different email" : "Use a different email or resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}