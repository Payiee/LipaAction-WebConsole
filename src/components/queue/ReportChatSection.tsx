"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n";
import { getChatLock } from "@/app/actions/reportChat";
import { callAction } from "@/lib/callAction";
import { REPORT_CHAT_MEDIA } from "@/lib/features";
import { MAX_MESSAGE_LENGTH, type ChatLock, type ChatMessage, type ChatThread } from "@/lib/reportChat";
import {
  MAX_PHOTOS,
  canAddKind,
  formatDuration,
  kindOfFile,
  type MediaSendOutcome,
  type PickRefusal,
} from "@/lib/chatMedia";
import type { PreparedMedia } from "@/lib/chatMediaPrepare";
import { Button } from "@/components/ui/Button";
import { buildThreadItems } from "@/lib/chatThreadView";
import { openedBy, seenAvatarsByMessage, type Seer } from "@/lib/chatSeen";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import { useReportChat } from "./useReportChat";
import { useChatSeen } from "./useChatSeen";
import { ChatAvatar, agencyLabelOf } from "./ChatAvatar";
import { ChatAttachments } from "./ChatAttachments";
import type { AgencyLabel } from "./useAgencyDirectory";

// Loaded the first time a photo or video is opened: most openings of the
// pop-up never show one.
const ChatMediaViewer = dynamic(() => import("./ChatMediaViewer").then((m) => m.ChatMediaViewer), { ssr: false });

// Each failed send is worded in the official's language; "sent" and null
// (the action never answered) are handled in submit().
const OUTCOME_KEY = {
  invalid: "chat.err.invalid",
  discreet: "chat.err.discreet",
  closed: "chat.err.closed",
  "rate-limited": "chat.err.rateLimited",
  "daily-cap": "chat.err.dailyCap",
  "not-accepting": "chat.err.notAccepting",
  refused: "chat.err.refused",
  "no-barangay": "chat.err.noBarangay",
  "session-expired": "chat.err.sessionExpired",
  unreachable: "chat.err.unreachable",
  off: "chat.err.off",
  failed: "chat.err.failed",
  // Chat media only (REPORT_CHAT_MEDIA).
  "media-invalid": "chat.media.err.invalid",
  "media-missing": "chat.media.err.missing",
  "upload-refused": "chat.media.err.uploadRefused",
  "upload-too-large": "chat.media.err.tooLarge",
  "upload-failed": "chat.media.err.uploadFailed",
} as const satisfies Record<Exclude<MediaSendOutcome, "sent">, string>;

// Why a picked file was not attached, in the official's language.
const PICK_KEY = {
  "too-many": "chat.media.pick.tooMany",
  mixed: "chat.media.pick.mixed",
  "file-type": "chat.media.pick.fileType",
  "photo-unreadable": "chat.media.pick.photoUnreadable",
  "photo-too-large": "chat.media.pick.tooLarge",
  "photo-metadata": "chat.media.pick.photoMetadata",
  "video-unreadable": "chat.media.pick.videoUnreadable",
  "video-too-long": "chat.media.pick.videoTooLong",
  "video-too-large": "chat.media.pick.tooLarge",
  "video-not-mp4": "chat.media.pick.videoNotMp4",
  "video-location": "chat.media.pick.videoLocation",
} as const satisfies Record<PickRefusal, string>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// The composer grows with what is typed, up to about six lines, then scrolls.
const COMPOSER_MAX_PX = 144;

/**
 * The text thread between this report's reporter and the desk, laid out like
 * a web messenger: the thread scrolls, the composer stays pinned under it.
 * Rendered by the report pop-up only while REPORT_CHAT_LIVE is true, and
 * never for a discreet report (which has no thread): the pop-up decides
 * that, this component assumes a thread may exist.
 *
 * It fills the height its parent gives it (the pop-up's chat column), so it
 * must sit in a flex column with a bounded height.
 *
 * `thread` is given only under REPORT_CHAT_V2, by ReportChatThreads. Without
 * it this is the v1 chat exactly. With it, the section shows that thread:
 * agency messages under the agency's name, the agencies that have opened
 * it, and a small avatar under the newest message each participant has
 * seen, as a messenger does.
 *
 * Under REPORT_CHAT_MEDIA (v2 threads only) a message can also carry up to
 * 4 photos or 1 video: the composer gets an attach button, and each
 * message's files are drawn as tiles that open a full-size viewer.
 * `onViewerChange` tells the pop-up when that viewer is open, so it can
 * stand its own Escape and focus trap down, as for the expanded map.
 */
export function ReportChatSection({
  reportId,
  focusComposer = false,
  thread,
  agencies,
  agencyConsentPending = false,
  onViewerChange,
}: {
  reportId: string;
  // Set when the pop-up was opened from a row's [Chat] button: the official
  // came to write, so the composer is focused.
  focusComposer?: boolean;
  // v2 only: which thread, and the agencies' names by id.
  thread?: ChatThread;
  agencies?: Map<string, AgencyLabel>;
  // v2 group thread only: the agencies can't read it yet, because the
  // reporter hasn't accepted the consent notice that covers agency chat.
  agencyConsentPending?: boolean;
  // REPORT_CHAT_MEDIA only: the media viewer opened or closed.
  onViewerChange?: (open: boolean) => void;
}) {
  const t = useT();
  const { showToast } = useToast();
  const {
    messages,
    state,
    capped,
    live,
    isSending,
    send,
    attachments,
    attachmentsFailed,
    retryAttachments,
    sendMedia,
    uploadProgress,
  } = useReportChat(reportId, true, thread);
  // Media lives only in the v2 threads.
  const mediaOn = REPORT_CHAT_MEDIA && thread !== undefined;
  // v2 only; with no thread nothing is read and no channel is joined.
  const { rows: seenRows } = useChatSeen(reportId, thread ?? "group", thread !== undefined);
  const seenUnder = useMemo(
    () => (thread ? seenAvatarsByMessage(thread, messages, seenRows) : new Map<string, Seer[]>()),
    [thread, messages, seenRows]
  );
  const openers = useMemo(() => (thread ? openedBy(thread, messages, seenRows) : []), [thread, messages, seenRows]);
  const nameOf = (agencyId: string | null) => agencyLabelOf(agencies, agencyId, t).name;
  const senderLabel = (m: ChatMessage) =>
    m.side === "agency" ? nameOf(m.agencyId) : t(m.side === "barangay" ? "chat.fromDesk" : "chat.fromReporter");
  const [draft, setDraft] = useState("");
  // Set once a send says the thread no longer takes messages, so the
  // composer stops offering what the backend will refuse.
  const [locked, setLocked] = useState(false);
  // When the thread locks, read up front so a closed report's composer is
  // disabled before anyone types, and an upcoming lock is announced.
  const [lock, setLock] = useState<ChatLock>({ kind: "unknown" });
  const threadRef = useRef<HTMLUListElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  // The draft box fits its text: back to one line when the text is
  // short or sent, taller as it grows (max-h-48 caps it, then it scrolls).
  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);
  const items = useMemo(() => buildThreadItems(messages), [messages]);

  // Chat media: the files waiting in the composer, and the open viewer.
  const [picked, setPicked] = useState<PreparedMedia[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [viewer, setViewer] = useState<{ messageId: string; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerMessage = viewer ? messages.find((m) => m.id === viewer.messageId) : undefined;
  const viewerFiles = viewer ? attachments.get(viewer.messageId) : undefined;
  const viewerOpen = viewer !== null && viewerFiles !== undefined && viewerFiles.length > 0;

  useEffect(() => {
    onViewerChange?.(viewerOpen);
  }, [viewerOpen, onViewerChange]);
  // Closing the thread with the viewer open must not leave the pop-up
  // thinking something is stacked on it.
  useEffect(() => () => onViewerChange?.(false), [onViewerChange]);

  // Each preview is an object URL; it is released when its file leaves the
  // composer, and all of them when the thread closes.
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useEffect(
    () => () => {
      pickedRef.current.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    },
    []
  );
  const removePicked = (key: string) =>
    setPicked((prev) => {
      prev.filter((p) => p.key === key).forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      return prev.filter((p) => p.key !== key);
    });
  const clearPicked = () =>
    setPicked((prev) => {
      prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      return [];
    });

  // Up to 4 photos or 1 video. Each file is checked and, for a photo,
  // re-encoded before it joins the composer; one that can't go is named in
  // a toast and left out.
  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setPreparing(true);
    try {
      // The re-encode and the video checks load only when a file is picked.
      const { prepareFile } = await import("@/lib/chatMediaPrepare");
      const kinds = picked.map((p) => p.kind);
      const ready: PreparedMedia[] = [];
      for (const file of files) {
        const kind = kindOfFile(file);
        if (!kind) {
          showToast(t(PICK_KEY["file-type"]), "danger");
          continue;
        }
        const fits = canAddKind(kinds, kind);
        if (fits !== true) {
          showToast(t(PICK_KEY[fits]), "danger");
          continue;
        }
        const result = await prepareFile(file);
        if (!result.ok) {
          showToast(t(PICK_KEY[result.reason]), "danger");
          continue;
        }
        kinds.push(kind);
        ready.push(result.media);
      }
      if (ready.length > 0) setPicked((prev) => [...prev, ...ready]);
    } finally {
      setPreparing(false);
    }
  };

  // Runs before the dialog's focus trap claims the dialog itself, which only
  // does so when nothing inside has focus.
  useEffect(() => {
    if (focusComposer) draftRef.current?.focus({ preventScroll: true });
  }, [focusComposer]);

  useEffect(() => {
    let cancelled = false;
    void callAction(() => getChatLock(reportId)).then((result) => {
      if (cancelled || !result) return;
      setLock(result);
      if (result.kind === "locked") setLocked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // Newest message in view. Scrolls the thread itself, not the page:
  // scrollIntoView would also move the pop-up's other scroll areas.
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, state]);

  // Auto-grow: reset, then fit to content.
  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft, locked]);

  const trimmed = draft.trim();
  const withMedia = mediaOn && picked.length > 0;
  // With files attached the text may be empty.
  const canSend =
    !isSending &&
    !locked &&
    !preparing &&
    trimmed.length <= MAX_MESSAGE_LENGTH &&
    (trimmed.length > 0 || withMedia);

  const submit = async () => {
    if (!canSend) return;
    const outcome: MediaSendOutcome | null = withMedia ? await sendMedia(trimmed, picked) : await send(trimmed);
    if (outcome === "sent") {
      setDraft("");
      if (withMedia) clearPicked();
      return;
    }
    if (outcome === null) {
      // The draft stays: the message may or may not have been stored.
      showToast(t("chat.err.noAnswer"), "danger");
      return;
    }
    if (outcome === "closed") setLocked(true);
    showToast(t(OUTCOME_KEY[outcome]), "danger");
  };

  return (
    <section aria-labelledby="report-chat-title" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-ink-100 px-4 py-2">
        <p id="report-chat-title" className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {t(thread === "desk" ? "chat.v2.title.desk" : thread === "group" ? "chat.v2.title.group" : "chat.title")}
        </p>
        {thread && (
          <p className={`text-xs ${thread === "desk" ? "font-medium text-ink-700" : "text-ink-500"}`}>
            {t(thread === "desk" ? "chat.v2.deskNote" : "chat.v2.groupNote")}
          </p>
        )}
        {thread === "group" && agencyConsentPending && (
          <p role="note" className="mt-1 text-xs font-medium text-ink-700">
            {t("chat.v2.agencyConsentPending")}
          </p>
        )}
        <p className="text-xs text-ink-500">{t(mediaOn ? "chat.media.closeWarning" : "chat.closeWarning")}</p>
        {thread && state === "ready" && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-ink-500">{t("chat.v2.openedBy")}</span>
            {openers.length === 0 && <span className="text-xs text-ink-500">{t("chat.v2.openedByNone")}</span>}
            {openers.map((o) => {
              const name = nameOf(o.agencyId);
              const label = t(o.caughtUp ? "chat.v2.openedSeen" : "chat.v2.openedNotSeen", {
                agency: name,
                date: formatTime(o.openedAt),
              });
              return (
                <span
                  key={o.agencyId}
                  title={label}
                  className={`inline-flex items-center gap-1 rounded-full border border-ink-100 py-0.5 pl-0.5 pr-2 text-xs ${
                    o.caughtUp ? "bg-white text-ink-900" : "bg-ink-50 text-ink-700"
                  }`}
                >
                  <ChatAvatar side="agency" agencyId={o.agencyId} agencies={agencies} />
                  <span aria-hidden>{name}</span>
                  {o.caughtUp && <Icon name="check" className="h-3 w-3 text-brand-600" />}
                  <span className="sr-only">{label}</span>
                </span>
              );
            })}
          </div>
        )}
        {lock.kind === "locks" && (
          <p role="note" className="mt-1 text-xs font-medium text-ink-700">
            {t("chat.lockNotice", { date: formatTime(lock.at) })}
          </p>
        )}
        {state === "ready" && !live && <p className="mt-1 text-xs text-ink-500">{t("chat.notLive")}</p>}
        {state === "ready" && capped && <p className="mt-1 text-xs text-ink-500">{t("chat.capped")}</p>}
      </div>

      {state === "loading" && <p className="flex-1 px-4 py-3 text-sm text-ink-500">{t("chat.loading")}</p>}
      {state === "failed" && <p className="flex-1 px-4 py-3 text-sm text-priority-medium">{t("chat.loadFailed")}</p>}
      {state === "ready" && (
        <ul
          ref={threadRef}
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-4 py-3"
          aria-live="polite"
        >
          {messages.length === 0 && (
            // An empty thread says what it is for and how to begin, rather
            // than a bare line that reads like a loading failure.
            <li className="m-auto flex max-w-xs flex-col items-center px-4 py-8 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon name="chat" className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium text-ink-900">{t("chat.empty")}</span>
              <span className="mt-1 text-sm text-ink-500">{t("chat.emptyBody")}</span>
            </li>
          )}
          {items.map((item) => {
            if (item.kind === "day") {
              return (
                <li key={`day-${item.key}`} className="my-3 text-center text-xs font-medium text-ink-500">
                  {formatDay(item.iso)}
                </li>
              );
            }
            const { message: m, side, showMeta } = item;
            const fromDesk = side === "desk";
            const seers = seenUnder.get(m.id);
            const hasMedia = mediaOn && m.mediaCount > 0;
            return (
              <li key={m.id} className={`flex flex-col ${fromDesk ? "items-end" : "items-start"} ${showMeta ? "mb-2" : ""}`}>
                {hasMedia && (
                  <div className="mb-0.5 max-w-[75%]">
                    <ChatAttachments
                      count={m.mediaCount}
                      attachments={attachments.get(m.id)}
                      failed={attachmentsFailed.has(m.id)}
                      senderLabel={senderLabel(m)}
                      onOpen={(index) => setViewer({ messageId: m.id, index })}
                      onRetry={retryAttachments}
                    />
                  </div>
                )}
                {/* A media message may have no text; it then has no bubble. */}
                {!(hasMedia && m.body === "") && (
                  // A messenger bubble: the corner nearest the sender squared
                  // off, so each one points at who wrote it.
                  <p
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      fromDesk
                        ? "rounded-br-md bg-brand-500 text-white"
                        : m.side === "agency"
                          ? "rounded-bl-md border border-ink-100 bg-white text-ink-900"
                          : "rounded-bl-md bg-ink-100 text-ink-900"
                    }`}
                  >
                    {m.body}
                  </p>
                )}
                {showMeta && !thread && (
                  <p className="mt-0.5 px-1 text-xs text-ink-500">
                    {t(fromDesk ? "chat.fromDesk" : "chat.fromReporter")} · {formatClock(m.createdAt)}
                    {fromDesk && m.readAt ? ` · ${t("chat.read")}` : ""}
                  </p>
                )}
                {showMeta && thread && (
                  <p className="mt-0.5 flex items-center gap-1 px-1 text-xs text-ink-500">
                    {m.side === "agency" && <ChatAvatar side="agency" agencyId={m.agencyId} agencies={agencies} />}
                    <span>
                      {senderLabel(m)} · {formatClock(m.createdAt)}
                    </span>
                  </p>
                )}
                {seers && seers.length > 0 && (
                  // Messenger's seen avatars: everyone whose newest seen
                  // message is this one, under the bubble at the right.
                  <p className="mt-0.5 flex w-full justify-end gap-0.5 px-1">
                    <span className="sr-only">
                      {t("chat.v2.seenBy", {
                        names: seers
                          .map((s) => (s.side === "resident" ? t("chat.fromReporter") : nameOf(s.agencyId)))
                          .join(", "),
                      })}
                    </span>
                    {seers.map((s) => (
                      <ChatAvatar key={s.key} side={s.side} agencyId={s.agencyId} agencies={agencies} />
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-ink-100 px-4 py-3">
        {locked ? (
          <p role="note" className="text-sm text-ink-700">
            {t("chat.readOnly")}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="report-chat-draft" className="sr-only">
              {t(
                thread === "desk"
                  ? "chat.v2.composerLabel.desk"
                  : thread === "group"
                    ? "chat.v2.composerLabel.group"
                    : "chat.composerLabel"
              )}
            </label>
            {mediaOn && picked.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2" aria-label={t("chat.media.pickedLabel")}>
                {picked.map((p, i) => (
                  <li key={p.key} className="relative">
                    {p.kind === "photo" && p.previewUrl ? (
                      // A local blob: URL of the re-encoded photo, never uploaded yet.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.previewUrl}
                        alt={t("chat.media.pickedPhoto", { n: i + 1 })}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-24 flex-col items-center justify-center gap-0.5 rounded-lg bg-ink-900 text-xs text-white">
                        <Icon name="play" className="h-4 w-4" />
                        {t("chat.media.video")} {formatDuration(p.durationS ?? null)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePicked(p.key)}
                      disabled={isSending}
                      aria-label={t("chat.media.remove", { n: i + 1 })}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-700 shadow-sm disabled:opacity-50"
                    >
                      <Icon name="close" className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              {mediaOn && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    // Photos in any format the browser can decode (they are
                    // re-encoded to JPEG); videos as MP4 only.
                    accept="image/*,video/mp4"
                    multiple
                    hidden
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      // So the same file can be picked again after removal.
                      e.target.value = "";
                      void addFiles(files);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-w-11"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || preparing || picked.some((p) => p.kind === "video") || picked.length >= MAX_PHOTOS}
                    aria-label={t("chat.media.attach")}
                    title={t("chat.media.attachHint")}
                  >
                    <Icon name="attach" />
                  </Button>
                </>
              )}
              <textarea
                id="report-chat-draft"
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter is a new line. Not while an
                  // input method is composing: Enter then confirms the text.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={1}
                readOnly={isSending}
                // Grows with the message up to about eight lines, then
                // scrolls, so the whole text can be read before it is sent.
                className="max-h-48 min-h-11 flex-1 resize-none overflow-y-auto rounded-2xl border border-ink-100 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" variant="primary" disabled={!canSend}>
                {t("chat.send")}
              </Button>
            </div>
            {mediaOn ? (
              <p className="mt-1 flex justify-between gap-2 text-xs text-ink-500">
                <span role="status">
                  {preparing
                    ? t("chat.media.preparing")
                    : uploadProgress
                      ? t("chat.media.uploading", { n: Math.min(uploadProgress.done + 1, uploadProgress.total), total: uploadProgress.total })
                      : ""}
                </span>
                <span>
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-right text-xs text-ink-500">
                {draft.length}/{MAX_MESSAGE_LENGTH}
              </p>
            )}
          </form>
        )}
      </div>
      {viewerOpen && viewer && viewerFiles && (
        <ChatMediaViewer
          attachments={viewerFiles}
          startIndex={viewer.index}
          caption={viewerMessage ? `${senderLabel(viewerMessage)} · ${formatTime(viewerMessage.createdAt)}` : ""}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
