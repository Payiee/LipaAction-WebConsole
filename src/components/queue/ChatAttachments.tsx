"use client";

import { useT } from "@/lib/i18n";
import { formatDuration, type ChatAttachment } from "@/lib/chatMedia";
import { Icon } from "@/components/ui/Icon";
import { useNearScreen, useSignedMediaUrl } from "./useSignedMediaUrl";

/**
 * A message's photos or video inside the thread (REPORT_CHAT_MEDIA).
 *
 * - A photo is a tile that loads its signed URL only when it comes near the
 *   screen, and the browser loads the picture lazily on top of that.
 * - A video is a tile with its length and a play mark; nothing of it is
 *   fetched until the official opens it, and it never plays by itself.
 *
 * Either opens the viewer at that file. While the attachment rows are still
 * being read, `attachments` is undefined and `count` grey tiles hold the
 * place; when they can't be read, one line says so with a Retry.
 */
export function ChatAttachments({
  count,
  attachments,
  failed,
  senderLabel,
  onOpen,
  onRetry,
}: {
  count: number;
  attachments: ChatAttachment[] | undefined;
  failed: boolean;
  senderLabel: string;
  onOpen: (index: number) => void;
  onRetry: () => void;
}) {
  const t = useT();

  if (failed) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-700">
        {t("chat.media.loadFailed")}
        <button type="button" onClick={onRetry} className="min-h-11 font-medium text-brand-600 underline">
          {t("chat.media.retry")}
        </button>
      </p>
    );
  }

  if (attachments === undefined) {
    return (
      <div className={`grid gap-1 ${count > 1 ? "grid-cols-2" : "grid-cols-1"}`} aria-label={t("chat.media.loading")}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="block h-28 w-28 animate-pulse rounded-xl bg-ink-100" />
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <p className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
        {t("chat.media.unavailable")}
      </p>
    );
  }

  const single = attachments.length === 1;
  return (
    <ul className={`grid gap-1 ${single ? "grid-cols-1" : "grid-cols-2"}`}>
      {attachments.map((a, i) => (
        <li key={a.id}>
          {a.kind === "video" ? (
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={t("chat.media.openVideo", { name: senderLabel, length: formatDuration(a.durationS) })}
              className="flex h-28 w-44 flex-col items-center justify-center gap-1 rounded-xl bg-ink-900 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <Icon name="play" className="h-6 w-6" />
              <span className="text-xs">
                {t("chat.media.video")} {formatDuration(a.durationS)}
              </span>
            </button>
          ) : (
            <PhotoTile
              attachment={a}
              single={single}
              label={t("chat.media.openPhoto", { n: i + 1, total: attachments.length, name: senderLabel })}
              onOpen={() => onOpen(i)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function PhotoTile({
  attachment,
  single,
  label,
  onOpen,
}: {
  attachment: ChatAttachment;
  single: boolean;
  label: string;
  onOpen: () => void;
}) {
  const t = useT();
  const { ref, near } = useNearScreen<HTMLButtonElement>();
  const { url, failed, onLoadError } = useSignedMediaUrl(attachment.path, near);
  // One photo keeps its own shape (within 240 by 240); several are squares.
  const ratio =
    single && attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : "1 / 1";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label={label}
      style={{ aspectRatio: ratio }}
      className={`block overflow-hidden rounded-xl bg-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
        single ? "max-h-60 w-60 max-w-full" : "h-28 w-28"
      }`}
    >
      {failed ? (
        <span className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-ink-500">
          {t("chat.media.photoFailed")}
        </span>
      ) : (
        url && (
          // A short-lived signed URL from Storage; next/image would proxy and
          // cache a private file, which is exactly what must not happen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onLoadError}
            className="h-full w-full object-cover"
          />
        )
      )}
    </button>
  );
}
