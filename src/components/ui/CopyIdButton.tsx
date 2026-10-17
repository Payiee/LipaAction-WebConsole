"use client";

import { useT } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

/**
 * Copies a report id, for an official who needs to quote it to an agency or
 * look it up later. A 44 px icon button; its label names the id, so a screen
 * reader says which report it copies.
 */
export function CopyIdButton({ id }: { id: string }) {
  const t = useT();
  const { showToast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      showToast(t("common.copied"), "success");
    } catch {
      // No clipboard permission, or an insecure page: the id stays on
      // screen to select by hand.
      showToast(t("common.copyFailed"), "info");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("common.copyId", { id })}
      title={t("common.copyIdShort")}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900"
    >
      <Icon name="copy" />
    </button>
  );
}
