"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { formatDuration, type ChatAttachment } from "@/lib/chatMedia";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { useSignedMediaUrl } from "./useSignedMediaUrl";

/**
 * One message's photos or video at full size, over the report pop-up
 * (REPORT_CHAT_MEDIA). Photos step with Previous / Next or the arrow keys.
 * A video shows the browser's own controls and never starts by itself.
 *
 * Stacks like MapLightbox: z-[60], its own Escape and focus trap, and the
 * pop-up disables its own while this is open (ReportDetailPanel's
 * `stacked`, through ReportChatSection's onViewerChange).
 */
export function ChatMediaViewer({
  attachments,
  startIndex,
  caption,
  onClose,
}: {
  attachments: ChatAttachment[];
  startIndex: number;
  caption: string;
  onClose: () => void;
}) {
  const t = useT();
  useDismissOnEscape(onClose);
  const dialogRef = useFocusTrap<HTMLDivElement>();
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), attachments.length - 1));
  const current = attachments[index];
  const many = attachments.length > 1;

  useEffect(() => {
    if (!many) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") setIndex((i) => (i - 1 + attachments.length) % attachments.length);
      if (event.key === "ArrowRight") setIndex((i) => (i + 1) % attachments.length);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [many, attachments.length]);

  if (!current) return null;
  const position = many ? t("chat.media.position", { n: index + 1, total: attachments.length }) : "";

  return (
    <div className="fixed inset-0 z-[60] flex bg-ink-900/80 p-2 sm:p-6 motion-safe:animate-scrimIn">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-media-viewer-title"
        className="relative flex h-full w-full flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-2">
          <p id="chat-media-viewer-title" className="truncate text-sm font-semibold text-ink-900">
            {t(current.kind === "video" ? "chat.media.viewerVideo" : "chat.media.viewerPhoto")}
            {position && <span className="ml-2 font-normal text-ink-500">{position}</span>}
          </p>
          <Button variant="ghost" size="sm" className="min-w-11" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-ink-900">
          {/* A new file is a new element: its own URL, load and error state. */}
          <ViewerMedia key={current.id} attachment={current} />
          {many && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="absolute left-2 top-1/2 min-w-11 -translate-y-1/2"
                onClick={() => setIndex((i) => (i - 1 + attachments.length) % attachments.length)}
                aria-label={t("chat.media.previous")}
              >
                <Icon name="previous" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="absolute right-2 top-1/2 min-w-11 -translate-y-1/2"
                onClick={() => setIndex((i) => (i + 1) % attachments.length)}
                aria-label={t("chat.media.next")}
              >
                <Icon name="next" />
              </Button>
            </>
          )}
        </div>
        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          {caption}
          {current.kind === "video" && current.durationS !== null ? ` · ${formatDuration(current.durationS)}` : ""}
        </p>
      </div>
    </div>
  );
}

function ViewerMedia({ attachment }: { attachment: ChatAttachment }) {
  const t = useT();
  const { url, failed, onLoadError } = useSignedMediaUrl(attachment.path, true);

  if (failed) return <p className="px-4 text-sm text-white">{t("chat.media.photoFailed")}</p>;
  if (!url) return <p className="px-4 text-sm text-white">{t("chat.media.loading")}</p>;
  if (attachment.kind === "video") {
    return (
      // No autoplay, and only the length and first frame until Play is
      // pressed. The thread has no captions to offer for a resident's clip.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onError={onLoadError}
        className="max-h-full max-w-full"
      />
    );
  }
  return (
    // A short-lived signed URL; see ChatAttachments.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={t("chat.media.photoAlt")} onError={onLoadError} className="max-h-full max-w-full object-contain" />
  );
}
