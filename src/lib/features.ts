/**
 * Backend features the console cannot detect on its own, switched here by
 * hand on the day the backend owner confirms they are live in production.
 */

/**
 * Whether the backend writes duplicate clusters back onto reports (its Step
 * 24). Until it does, the Flagged duplicates tab and Cluster Explorer stay
 * empty whatever is filed, and their empty states say grouping isn't
 * connected. An empty list looks the same either way, so nothing on the page
 * can tell which case it is in: when write-back is live, set this to true and
 * the empty states switch to copy that describes the grouping instead.
 *
 * On since 2026-10-01, when the backend owner confirmed write-back is live
 * and the first real clusters appeared in Inosluban.
 */
export const DUPLICATE_WRITEBACK_LIVE: boolean = true;

/**
 * Whether the backend lets a barangay desk close an Other-report itself,
 * without sending it to an agency (resolve_report_at_barangay). The backend
 * owner agreed the contract on 2026-10-05 and is building it; until it is on
 * prod the [Resolve at barangay] button stays hidden and the action refuses:
 * a button that can only fail is worse than none.
 *
 * The flag also guards two reads. incident_reports.barangay_resolved_at and
 * the barangay_resolutions table arrive with the same migration, and a
 * select that names a column that doesn't exist yet fails the whole page,
 * so Validation History and the city report list ask for them only when
 * this is true. Never set it to true before the migration is on prod.
 *
 * On since 2026-10-05: the backend owner confirmed the migration is on prod
 * (17:33 Manila), and the column, the table and the function were each seen
 * to exist before the switch.
 */
export const BARANGAY_RESOLVE_LIVE: boolean = true;

/**
 * Whether the backend has the report chat: the report_messages table and
 * the functions send_report_message() and mark_report_messages_read(). The
 * backend owner built them on 2026-10-06 and put them on prod the same night (migration 20261124090000, checked read-only: RLS on, 3 policies).
 *
 * While this is false the console asks for none of it. The drawer shows no
 * chat and no Reporter section, the queue reads no unread messages and
 * joins no message channel, and every action in
 * src/app/actions/reportChat.ts refuses before any read. A select on a table
 * that doesn't exist yet fails, and a composer that can only fail is worse
 * than none.
 *
 * Never set it to true before the backend owner confirms the migration is
 * on prod.
 */
export const REPORT_CHAT_LIVE: boolean = true;

/**
 * Whether the backend has the report chat v2: agencies in the report's
 * thread, a desk-only thread between the barangay desk and the routed
 * agencies, and seen markers. That is the backend's migration
 * 20261125090000 (report_messages.agency_id, the tables
 * report_desk_messages and report_chat_seen, and the functions
 * send_report_chat_message(), mark_report_chat_seen() and
 * report_chat_access()), pushed together with its consent migration
 * 20261125080000; its contract is the backend's
 * docs/specs/2026-10-08-report-chat-v2-design.md. It is an addition the
 * backend owner approved on 2026-10-08, outside Chapter 3.
 *
 * While this is false the chat is exactly the v1 chat above: one thread,
 * resident and desk only, the v1 columns, the v1 functions, the v1 channel.
 * Nothing v2 is read, joined or called, and the three v2 actions in
 * src/app/actions/reportChat.ts (sendDeskMessage, markReportChatSeen,
 * getAgencyGroupAccess) refuse before any read. A select that names
 * agency_id, or either new table, fails until the migration is on prod.
 *
 * With it true the drawer's chat shows agency messages under the agency's
 * name, adds the staff-only Desk thread (on a report routed to an agency),
 * draws who has seen what, lists the agencies that have opened the chat,
 * and says when the agencies can't read the group thread yet because the
 * reporter hasn't accepted the consent notice that covers agency chat. It
 * needs REPORT_CHAT_LIVE too.
 *
 * Never set it to true before the backend owner confirms the migration is
 * on prod.
 *
 * Switched on 2026-10-08: both migrations were pushed to prod that day at
 * 11:37 UTC (the backend owner's go, plan v8 P4).
 */
export const REPORT_CHAT_V2: boolean = true;

/**
 * Whether the backend has chat media: photos and short videos in both
 * threads of the v2 chat. That is the backend's migration 20261126090000
 * (report_messages.media_count and report_desk_messages.media_count, the
 * table report_chat_attachments, the function send_report_chat_media(),
 * and the private Storage bucket report-chat-media with its two policies);
 * its contract is the backend's
 * docs/specs/2026-10-08-report-chat-media-design.md. Like the chat itself,
 * it is an addition the backend owner approved on 2026-10-08, outside
 * Chapter 3.
 *
 * While this is false the chat is exactly the v2 chat above: nothing reads
 * media_count or report_chat_attachments, nothing touches the bucket, the
 * composer has no attach button, the page's Content-Security-Policy is
 * unchanged, and sendChatMedia in src/app/actions/reportChat.ts refuses
 * before any read. A select that names media_count fails until the
 * migration is on prod.
 *
 * With it true the desk can attach up to 4 photos or 1 video (MP4, at most
 * 30 seconds, at most 25 MB) to a message on either thread, and sees
 * everyone's attachments through short-lived signed URLs. It needs
 * REPORT_CHAT_V2 and REPORT_CHAT_LIVE too: media lives only in the v2
 * threads.
 *
 * Never set it to true before the backend owner confirms the migration is
 * on prod.
 */
export const REPORT_CHAT_MEDIA: boolean = false;
