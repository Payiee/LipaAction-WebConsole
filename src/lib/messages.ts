import { NO_ANSWER } from "@/lib/callAction";
import { REJECT_REASON_LABELS } from "@/lib/utils";

export type Lang = "en" | "tl";

type Entry = { en: string; tl: string };

/**
 * Every interface string the EN/TL switch covers, English and Tagalog side by
 * side so a missing translation is visible in review rather than at runtime.
 *
 * The English column is the console's existing copy, unchanged. Where the
 * English screen already carried a short Tagalog hint beside a term (the
 * mockups' bilingual labels, Ch. 3 §3.7.3), the hint stays in the English
 * string; the Tagalog string doesn't repeat it.
 *
 * The Tagalog column was reviewed on 2026-09-29 — change wording here, never
 * in a component.
 *
 * Deliberately not in this file, so they stay as they are in both languages:
 * - Anything a resident wrote (descriptions, their answers in the drawer).
 *   Translating a report would put words in the reporter's mouth.
 * - Values formatted from report data: category names, priority tiers (the
 *   model's class names), relative times like [5m ago] (worked out in the
 *   browser by timeAgo, still English), review timestamps, and error messages
 *   returned by server actions.
 * - The CSV export, which other offices read.
 * - Screens outside a gated page: sign-in, not-authorized, error pages, and
 *   the toast container's own dismiss label.
 *
 * `{name}` placeholders are filled by translate() in src/lib/i18n.tsx.
 */
export const MESSAGES = {
  // --- Shell: sidebar, top bar, account menu --------------------------------
  "shell.consoleName": { en: "Barangay console", tl: "Console ng Barangay" },
  "shell.openMenu": { en: "Open navigation menu", tl: "Buksan ang menu ng nabigasyon" },
  "shell.closeMenu": { en: "Close navigation", tl: "Isara ang nabigasyon" },
  "shell.breadcrumb": { en: "Breadcrumb", tl: "Kinaroroonan sa console" },
  "shell.accountMenu": { en: "Account menu for {name}", tl: "Menu ng account ni {name}" },
  "shell.signOut": { en: "Sign out", tl: "Mag-sign out" },
  "shell.language": { en: "Interface language", tl: "Wika ng interface" },
  "nav.queue": { en: "Queue", tl: "Pila ng Ulat" },
  "nav.clusterExplorer": { en: "Cluster Explorer", tl: "Mga Kumpol ng Ulat" },
  "nav.validationHistory": { en: "Validation History", tl: "Kasaysayan ng Pag-validate" },
  "nav.auditLog": { en: "Audit Log", tl: "Talaan ng Audit" },
  "nav.reports": { en: "Reports", tl: "Mga Buod" },
  "nav.settings": { en: "Settings", tl: "Mga Setting" },
  "nav.records": { en: "Records", tl: "Mga Rekord" },
  "nav.account": { en: "Account", tl: "Account" },
  "role.barangay_official": { en: "Brgy. Official", tl: "Opisyal ng Brgy." },
  "role.barangay_admin": { en: "Brgy. Admin", tl: "Admin ng Brgy." },
  "role.senior_barangay_admin": { en: "Senior Brgy. Admin", tl: "Senior Admin ng Brgy." },

  // --- Shared ---------------------------------------------------------------
  "common.cancel": { en: "Cancel", tl: "Kanselahin" },
  "common.close": { en: "Close", tl: "Isara" },
  "common.save": { en: "Save", tl: "I-save" },
  "common.working": { en: "Working…", tl: "Pinoproseso…" },
  "common.saving": { en: "Saving…", tl: "Sine-save…" },
  "common.noAnswer": {
    en: NO_ANSWER,
    tl: "Hindi makumpirma kung natuloy iyon. Tingnan muna ang pila bago subukang muli.",
  },
  "reporter.verified": { en: "Verified reporter", tl: "Beripikadong nag-ulat" },
  "reporter.withheld": {
    en: "Verified reporter, identity withheld",
    tl: "Beripikadong nag-ulat, nakatago ang pagkakakilanlan",
  },
  "priority.unscored": { en: "Not scored", tl: "Wala pang iskor" },
  "field.reporter": { en: "Reporter", tl: "Nag-ulat" },
  "field.timestamp": { en: "Timestamp", tl: "Oras" },
  "status.pending_priority": { en: "Pending", tl: "Nakabinbin" },
  "status.prioritized": { en: "Prioritized", tl: "Na-prioritize" },
  "status.validated": { en: "Validated", tl: "Na-validate" },
  "status.rejected": { en: "Rejected", tl: "Tinanggihan" },
  "status.routed": { en: "Routed to agency", tl: "Naipasa sa ahensya" },
  "status.resolved": { en: "Resolved", tl: "Nalutas" },
  "banner.title": { en: "{what} couldn't load.", tl: "Hindi na-load ang {what}." },
  "banner.body": {
    en:
      "Nothing below is current. Refresh the page; if it keeps happening, sign out and back " +
      "in, then tell the pilot support desk. · Hindi na-load ang datos. I-refresh ang page.",
    tl:
      "Hindi napapanahon ang anumang nasa ibaba. I-refresh ang page; kung patuloy itong " +
      "mangyari, mag-sign out at mag-sign in muli, saka ipaalam sa pilot support desk.",
  },
  "banner.what.queue": { en: "The queue", tl: "pila" },
  "banner.what.history": { en: "Validation History", tl: "Kasaysayan ng Pag-validate" },
  "banner.what.clusters": { en: "Cluster Explorer", tl: "Mga Kumpol ng Ulat" },
  "banner.what.reports": { en: "The daily summary", tl: "buod ng araw" },
  "banner.what.audit": { en: "The audit log", tl: "talaan ng audit" },

  // --- Queue page -----------------------------------------------------------
  "queue.tabsLabel": { en: "Queue sections", tl: "Mga seksyon ng pila" },
  "queue.tab.emergency": { en: "Emergency Fast-triage", tl: "Emergency (Mabilisang Triage)" },
  "queue.tab.standard": { en: "Standard intake", tl: "Karaniwang Ulat" },
  "queue.tab.duplicates": { en: "Flagged duplicates", tl: "Posibleng Doble" },
  "queue.tab.validated": { en: "Recent validated", tl: "Kamakailang Na-validate" },
  "queue.kpi.fastTriage": { en: "Fast-triage", tl: "Mabilisang triage" },
  "queue.kpi.standard": { en: "Standard intake", tl: "Karaniwang ulat" },
  "queue.kpi.medianWait": { en: "Median wait", tl: "Median na paghihintay" },
  "queue.kpi.validatedToday": { en: "Validated today", tl: "Na-validate ngayon" },
  "queue.kpi.duplicates": { en: "Flagged duplicates", tl: "Naka-flag na doble" },
  "queue.activity.title": { en: "Recent activity", tl: "Kamakailang aktibidad" },
  "queue.activity.intro": {
    en: "The newest events on this barangay's reports, by role. Shown to barangay admins.",
    tl: "Ang pinakabagong pangyayari sa mga ulat ng barangay na ito, ayon sa tungkulin. Ipinapakita sa mga admin ng barangay.",
  },
  "queue.activity.viewAll": { en: "Open the Audit Log", tl: "Buksan ang Talaan ng Audit" },
  "queue.activity.empty": { en: "No events yet.", tl: "Wala pang pangyayari." },
  "queue.activity.failed": { en: "Recent activity couldn't load.", tl: "Hindi na-load ang kamakailang aktibidad." },
  "queue.validateNext": { en: "Validate next", tl: "I-validate ang susunod" },
  "queue.nothingToValidate": {
    en: "Nothing left in this tab to validate",
    tl: "Wala nang ive-validate sa tab na ito",
  },
  "queue.searchPlaceholder": {
    en: "Search report ID, category, description…",
    tl: "Hanapin ang ID, kategorya, o paglalarawan…",
  },
  "queue.searchLabel": {
    en: "Search this tab by report ID, category, or description",
    tl: "Maghanap sa tab na ito ayon sa ID ng ulat, kategorya, o paglalarawan",
  },
  "queue.partialLoad": {
    en: "Part of this tab couldn’t be loaded, so it may be incomplete. Refresh to try again.",
    tl: "Hindi na-load ang bahagi ng tab na ito, kaya maaaring kulang ito. I-refresh para subukang muli.",
  },
  "queue.noMatch": {
    en: "No reports in this tab match “{query}”.",
    tl: "Walang ulat sa tab na ito na tumutugma sa “{query}”.",
  },
  "queue.loadFailedEmpty": {
    en: "Reports couldn’t be loaded — see the notice above.",
    tl: "Hindi na-load ang mga ulat — tingnan ang abiso sa itaas.",
  },
  "queue.empty": { en: "No reports in this queue right now.", tl: "Walang ulat sa pilang ito ngayon." },
  "queue.group.awaitingRouting": { en: "Awaiting routing", tl: "Naghihintay maipasa" },
  "queue.group.routed": { en: "Routed to agencies", tl: "Naipasa na sa mga ahensya" },
  "queue.footer.count": { en: "Showing {count} reports", tl: "Ipinapakita ang {count} ulat" },
  "queue.footer.countOne": { en: "Showing 1 report", tl: "Ipinapakita ang 1 ulat" },
  "queue.footer.filtered": {
    en: "Showing {shown} of {total} reports in this tab",
    tl: "Ipinapakita ang {shown} sa {total} ulat sa tab na ito",
  },
  "queue.footer.filteredOne": {
    en: "Showing {shown} of 1 report in this tab",
    tl: "Ipinapakita ang {shown} sa 1 ulat sa tab na ito",
  },
  "queue.footer.ranked": {
    en: "Ranked by priority score, then longest waiting",
    tl: "Nakaayos ayon sa iskor ng priyoridad, saka sa pinakamatagal nang naghihintay",
  },
  "queue.footer.rankedNewest": {
    en: "Sorted by newest first",
    tl: "Nakaayos ayon sa pinakabago muna",
  },
  "queue.footer.rankedOldest": {
    en: "Sorted by oldest first",
    tl: "Nakaayos ayon sa pinakaluma muna",
  },
  "queue.sort.label": { en: "Sort", tl: "Ayusin" },
  "queue.sort.priority": { en: "Priority", tl: "Priyoridad" },
  "queue.sort.newest": { en: "Newest first", tl: "Pinakabago muna" },
  "queue.sort.oldest": { en: "Oldest first", tl: "Pinakaluma muna" },
  "queue.footer.live": {
    en: "Live — updates as reports change",
    tl: "Live — nag-a-update habang nagbabago ang mga ulat",
  },
  "queue.footer.polling": {
    en: "Live updates unavailable — refreshes every {seconds} s",
    tl: "Walang live update — nagre-refresh bawat {seconds} segundo",
  },
  "queue.footer.connecting": { en: "Connecting to live updates…", tl: "Kumokonekta sa live update…" },
  "queue.footer.dataAsOf": { en: "Data as of {time}", tl: "Datos noong {time}" },
  "queue.footer.soundLocked": {
    en: "Click anywhere on the page to allow the alert sound",
    tl: "Mag-click kahit saan sa page para payagan ang tunog ng alerto",
  },
  "queue.footer.updateWaiting": {
    en: "Update waiting — it appears when you’re done here",
    tl: "May naghihintay na update — lalabas ito kapag tapos ka na rito",
  },
  "queue.dup.title": {
    en: "Duplicate flagging isn't connected yet",
    tl: "Hindi pa nakakonekta ang pag-flag ng doble",
  },
  "queue.dup.body": {
    en:
      "Reports aren't being grouped into duplicates yet, so this tab stays empty — that " +
      "doesn't mean none of today's reports are duplicates. Review each report in the " +
      "Emergency tab. When grouping is on, only reports with a location, from the same " +
      "barangay and filed within 72 hours of each other, can be grouped. · Hindi pa " +
      "nakakonekta ang pag-flag ng duplicate.",
    tl:
      "Hindi pa pinagsasama-sama ang mga ulat bilang doble, kaya walang laman ang tab na ito — " +
      "hindi ibig sabihin nito na walang dobleng ulat ngayong araw. Suriin ang bawat ulat sa " +
      "tab na Emergency. Kapag bukas na ang pagsasama-sama, ang mga ulat lang na may " +
      "lokasyon, mula sa iisang barangay, at naipadala sa loob ng 72 oras ng isa't isa ang " +
      "maaaring pagsamahin.",
  },
  // Shown instead of the two above once DUPLICATE_WRITEBACK_LIVE is on.
  "queue.dup.titleLive": {
    en: "No flagged duplicates right now",
    tl: "Walang naka-flag na doble sa ngayon",
  },
  "queue.dup.bodyLive": {
    en:
      "Pending reports the system judges to be the same incident show here, so they can be " +
      "reviewed together. It compares reports from the same barangay filed within 72 hours " +
      "of each other, weighing how close they are in place and time and their category, so " +
      "reports in different categories can still be grouped.",
    tl:
      "Lumalabas dito ang mga nakabinbing ulat na itinuring ng sistema na iisang insidente, " +
      "para masuri nang sabay. Pinaghahambing nito ang mga ulat mula sa iisang barangay na " +
      "naipadala sa loob ng 72 oras ng isa't isa, ayon sa lapit ng lugar at oras at sa " +
      "kategorya, kaya maaaring mapagsama ang mga ulat na magkaiba ang kategorya.",
  },
  "queue.sla.title": {
    en: "Tier 0 report past its 5-minute window",
    tl: "Lumampas na sa 5 minuto ang isang Tier 0 na ulat",
  },
  "queue.sla.discreet": {
    en: "Details hidden — discreet report. Open the queue.",
    tl: "Nakatago ang detalye — discreet na ulat. Buksan ang pila.",
  },
  "queue.sla.toast": {
    en: "A Tier 0 report is past its 5-minute window",
    tl: "May Tier 0 na ulat na lumampas na sa 5 minuto",
  },

  // --- Report row, review, routing ------------------------------------------
  "row.new": { en: "New", tl: "Bago" },
  "row.discreet": { en: "Discreet", tl: "Discreet" },
  "row.viewDetails": { en: "View details for {id}", tl: "Tingnan ang detalye ng {id}" },
  "row.resolvedValidated": {
    en: "Validated — route it from Recent validated",
    tl: "Na-validate — ipasa ito mula sa Kamakailang Na-validate",
  },
  "row.routingIncomplete": { en: "Routing incomplete", tl: "Hindi pa buo ang pagpasa" },
  "row.noMapping": {
    en: "No agency mapped — needs barangay review",
    tl: "Walang nakatalagang ahensya — kailangang suriin ng barangay",
  },
  "row.routingUnavailable": {
    en: "Couldn't load routing options — refresh",
    tl: "Hindi na-load ang mga opsyon sa pagpasa — i-refresh",
  },
  "row.returned": {
    en: "Returned by {agency}{more} — out of scope",
    tl: "Ibinalik ng {agency}{more} — labas sa saklaw",
  },
  "row.returnedChip": { en: "Returned by agencies", tl: "Ibinalik ng mga ahensya" },
  "row.autoRouted": { en: "Auto-routed", tl: "Awtomatikong naipasa" },
  "row.alreadyResolved": { en: "Already resolved, review", tl: "Naayos na raw, suriin" },
  "row.alreadyResolvedTitle": {
    en: "The reporter said it already resolved. Check before acting on it.",
    tl: "Sinabi ng nag-ulat na naayos na ito. Suriin muna bago kumilos.",
  },
  "row.returnedUnavailable": {
    en: "Couldn't load the agency list — refresh",
    tl: "Hindi na-load ang listahan ng ahensya — i-refresh",
  },
  "review.validate": { en: "Validate", tl: "I-validate" },
  "review.reject": { en: "Reject", tl: "Tanggihan" },
  "review.rejectTitle": { en: "Reject {id}?", tl: "Tanggihan ang {id}?" },
  "review.rejectDescription": {
    en: "Choose a reason. It's recorded on the report and shown to your barangay's desk.",
    tl: "Pumili ng dahilan. Itinatala ito sa ulat at makikita ng desk ng inyong barangay.",
  },
  "review.rejectConfirm": { en: "Reject report", tl: "Tanggihan ang ulat" },
  "review.validatedToast": {
    en: "{id} validated — not sent to any agency yet. It's under Recent validated.",
    tl: "Na-validate ang {id} — hindi pa naipapasa sa anumang ahensya. Nasa Kamakailang Na-validate ito.",
  },
  "review.rejectedToast": {
    en: "{id} rejected — moved to Validation History",
    tl: "Tinanggihan ang {id} — inilipat sa Kasaysayan ng Pag-validate",
  },
  "review.failed": { en: "Failed to update report", tl: "Hindi na-update ang ulat" },

  // --- CDRRMO dispatch (src/lib/cdrrmo-dispatch.ts) -------------------------
  // Shown only while the backend's cdrrmo_dispatch_enabled switch is on, and
  // only for Emergency reports. The Tagalog column is a draft, not yet
  // reviewed like the rest of this file.
  "cdrrmo.useValidate": {
    en: "Emergency reports now go to agencies through the city's CDRRMO. Use Validate; it sends the report on.",
    tl: "Sa CDRRMO ng lungsod na ipinapasa sa mga ahensya ang mga Emergency na ulat. Gamitin ang I-validate; ito ang magpapasa ng ulat.",
  },
  "cdrrmo.validateTitle": { en: "Validate {id}?", tl: "I-validate ang {id}?" },
  "cdrrmo.validateDescription": {
    en:
      "Validating sends it straight to its agencies through the city's CDRRMO: {names}. " +
      "The final list may include more agencies; only CDRRMO can add them. " +
      "This can't be undone from this console.",
    tl:
      "Kapag na-validate, ipapasa ito agad sa mga ahensya nito sa pamamagitan ng CDRRMO ng lungsod: {names}. " +
      "Maaaring may madagdag pang ahensya sa huling listahan; ang CDRRMO lang ang makakapagdagdag. " +
      "Hindi na ito mababawi mula sa console na ito.",
  },
  "cdrrmo.validateConfirm": { en: "Validate and send", tl: "I-validate at ipasa" },
  // A routed report the city's CDRRMO validated: the desk's validation is
  // recorded and nothing about the routing changes (returns 'recorded').
  "cdrrmo.recordDescription": {
    en: "The city's CDRRMO already validated it and it is with its agencies. This records that your barangay validated it too; nothing about its routing changes.",
    tl: "Na-validate na ito ng CDRRMO ng lungsod at nasa mga ahensya na ito. Itatala nito na na-validate rin ito ng inyong barangay; walang magbabago sa pagpasa nito.",
  },
  // A report sent to agencies automatically, before any review: validating
  // records the review and adds any default agency still missing, CDRRMO
  // included (returns 'routed').
  "cdrrmo.autoDescription": {
    en: "It was sent to agencies automatically, before any review. Validating records your barangay's review and adds any default agency still missing, CDRRMO included. Agencies already sent to keep it.",
    tl: "Awtomatiko itong naipasa sa mga ahensya bago masuri. Itatala ng pag-validate ang pagsusuri ng inyong barangay at idaragdag ang anumang default na ahensyang kulang pa, kasama ang CDRRMO. Mananatili ito sa mga ahensyang napasahan na.",
  },
  "cdrrmo.recordConfirm": { en: "Record validation", tl: "Itala ang validation" },
  "cdrrmo.notValidatedHere": {
    en: "Not yet validated by your barangay",
    tl: "Hindi pa na-validate ng inyong barangay",
  },
  "cdrrmo.cdrrmoAlways": { en: "CDRRMO (always)", tl: "CDRRMO (palagi)" },
  "cdrrmo.alwaysSuffix": { en: "(always)", tl: "(palagi)" },
  "cdrrmo.mappedAndCdrrmo": {
    en: "the agencies its category maps to, and CDRRMO",
    tl: "ang mga ahensyang nakatalaga sa kategorya nito, at ang CDRRMO",
  },
  "cdrrmo.preview": {
    en: "After validation, it goes straight to",
    tl: "Pagkatapos ma-validate, ipapasa ito agad sa",
  },
  "cdrrmo.previewNote": {
    en: "The final list may include more agencies; only CDRRMO can add them.",
    tl: "Maaaring may madagdag pang ahensya sa huling listahan; ang CDRRMO lang ang makakapagdagdag.",
  },
  "cdrrmo.pastReview": {
    en: "Emergency reports now go to agencies through the city's CDRRMO.",
    tl: "Sa CDRRMO ng lungsod na ipinapasa sa mga ahensya ang mga Emergency na ulat.",
  },
  "cdrrmo.legacyPartial": {
    en:
      "This report was partly sent before the city's CDRRMO took over Emergency routing. " +
      "Only CDRRMO can add agencies now; contact CDRRMO if it needs more.",
    tl:
      "Bahagya nang naipasa ang ulat na ito bago hawakan ng CDRRMO ng lungsod ang pagpasa ng mga Emergency. " +
      "Ang CDRRMO na lang ang makakapagdagdag ng ahensya; makipag-ugnayan sa CDRRMO kung kailangan pa.",
  },
  "cdrrmo.handedBack": {
    en: "Every agency sent it back. Only the city's CDRRMO can send it to another agency; contact CDRRMO if it needs action.",
    tl: "Ibinalik ito ng lahat ng ahensya. Ang CDRRMO ng lungsod lang ang makakapagpasa nito sa ibang ahensya; makipag-ugnayan sa CDRRMO kung kailangan itong aksyunan.",
  },
  "cdrrmo.rejectedByCdrrmo": { en: "Rejected by CDRRMO", tl: "Tinanggihan ng CDRRMO" },
  "cdrrmo.rejectedByCdrrmoBody": {
    en:
      "The city's CDRRMO rejected this report after it was routed. Agencies that hadn't acknowledged it no longer see it; " +
      "an agency already responding keeps it until it closes it. The barangay can't overturn a CDRRMO rejection.",
    tl:
      "Tinanggihan ng CDRRMO ng lungsod ang ulat na ito matapos itong maipasa. Hindi na ito nakikita ng mga ahensyang hindi pa kumikilala rito; " +
      "mananatili ito sa ahensyang tumutugon na hanggang isara nila ito. Hindi mababawi ng barangay ang pagtanggi ng CDRRMO.",
  },
  "cdrrmo.outcome.routed": {
    en: "{id} validated and sent to its agencies.",
    tl: "Na-validate ang {id} at naipasa na sa mga ahensya nito.",
  },
  "cdrrmo.outcome.recorded": {
    en: "{id}: your barangay's validation is recorded. It was already with its agencies.",
    tl: "{id}: naitala na ang validation ng inyong barangay. Nasa mga ahensya na ito.",
  },
  "cdrrmo.outcome.validated_no_open_agency": {
    en: "{id} validated. Every agency it maps to had already sent it back, so it is now with CDRRMO to send on.",
    tl: "Na-validate ang {id}. Naibalik na ito ng lahat ng nakatalagang ahensya, kaya nasa CDRRMO na ito para ipasa.",
  },
  "cdrrmo.outcome.rejected": {
    en: "{id} rejected — moved to Validation History",
    tl: "Tinanggihan ang {id} — inilipat sa Kasaysayan ng Pag-validate",
  },
  "cdrrmo.outcome.overridden": {
    en: "{id}: saved. The queue has been refreshed to show where it stands.",
    tl: "{id}: na-save. Na-refresh ang pila para makita ang kalagayan nito.",
  },
  "cdrrmo.outcome.saved-unknown": {
    en: "{id}: saved. The queue has been refreshed to show where it stands.",
    tl: "{id}: na-save. Na-refresh ang pila para makita ang kalagayan nito.",
  },
  "cdrrmo.outcome.already_validated": {
    en: "Your barangay already validated this report. Nothing more is needed here.",
    tl: "Na-validate na ng inyong barangay ang ulat na ito. Wala nang kailangang gawin dito.",
  },
  "cdrrmo.outcome.already_resolved": {
    en: "This report is already resolved.",
    tl: "Nalutas na ang ulat na ito.",
  },
  "cdrrmo.outcome.already_rejected": {
    en: "This report was already rejected.",
    tl: "Natanggihan na ang ulat na ito.",
  },
  "cdrrmo.outcome.cdrrmo_validated": {
    en: "The city's CDRRMO already validated this report, so it can't be rejected from the barangay desk.",
    tl: "Na-validate na ng CDRRMO ng lungsod ang ulat na ito, kaya hindi na ito matatanggihan mula sa desk ng barangay.",
  },
  "cdrrmo.outcome.cdrrmo_rejected": {
    en: "The city's CDRRMO rejected this report. The barangay can't overturn a CDRRMO rejection.",
    tl: "Tinanggihan ng CDRRMO ng lungsod ang ulat na ito. Hindi ito mababawi ng barangay.",
  },
  "cdrrmo.outcome.already_routed": {
    en: "This report was already sent to agencies automatically, so it can't be rejected. You can validate it from Recent validated.",
    tl: "Awtomatiko na itong naipasa sa mga ahensya, kaya hindi na ito matatanggihan. Maaari itong i-validate mula sa Kamakailang Na-validate.",
  },
  "cdrrmo.outcome.handed_back": {
    en: "Every agency sent this report back. Only the city's CDRRMO can send it to another agency; contact CDRRMO if it needs action.",
    tl: "Ibinalik ng lahat ng ahensya ang ulat na ito. Ang CDRRMO ng lungsod lang ang makakapagpasa nito sa ibang ahensya; makipag-ugnayan sa CDRRMO kung kailangan itong aksyunan.",
  },
  "cdrrmo.outcome.not_emergency": {
    en: "This isn't an Emergency report, so it's validated the usual way. The queue has been refreshed.",
    tl: "Hindi Emergency ang ulat na ito, kaya sa karaniwang paraan ito vina-validate. Na-refresh ang pila.",
  },
  "cdrrmo.outcome.not_found": {
    en: "That report isn't in your barangay, or no longer exists.",
    tl: "Wala sa inyong barangay ang ulat na iyon, o wala na ito.",
  },
  "cdrrmo.outcome.reason_required": {
    en: "Choose a reason to reject this report.",
    tl: "Pumili ng dahilan para tanggihan ang ulat na ito.",
  },
  "cdrrmo.outcome.refused": {
    en: "This report can't be changed from here. The queue has been refreshed to show where it stands.",
    tl: "Hindi na mababago ang ulat na ito mula rito. Na-refresh ang pila para makita ang kalagayan nito.",
  },
  "cdrrmo.outcome.disabled": {
    en: "Emergency routing through the city's CDRRMO is switched off. Use the usual Validate and Route to agency.",
    tl: "Naka-off ang pagpasa ng mga Emergency sa pamamagitan ng CDRRMO ng lungsod. Gamitin ang karaniwang I-validate at Ipasa sa ahensya.",
  },
  "cdrrmo.outcome.not-permitted": {
    en: "Not permitted — wrong barangay, or your account can't do this.",
    tl: "Hindi pinapayagan — ibang barangay, o hindi ito magagawa ng inyong account.",
  },
  "cdrrmo.outcome.invalid": {
    en: "That decision wasn't accepted. Refresh the report and try again.",
    tl: "Hindi tinanggap ang desisyong iyon. I-refresh ang ulat at subukang muli.",
  },
  "cdrrmo.outcome.session-expired": {
    en: "Your session expired. Sign in again.",
    tl: "Nag-expire ang iyong session. Mag-sign in muli.",
  },
  "cdrrmo.outcome.unreachable": {
    en: "Couldn't confirm the answer. The queue has been refreshed; check the report before trying again.",
    tl: "Hindi nakumpirma ang sagot. Na-refresh ang pila; suriin ang ulat bago subukang muli.",
  },
  "cdrrmo.outcome.unknown": {
    en: "Couldn't confirm the result. The queue has been refreshed to show where it stands.",
    tl: "Hindi nakumpirma ang resulta. Na-refresh ang pila para makita ang kalagayan nito.",
  },
  "reason.label": { en: "Reason", tl: "Dahilan" },
  "reason.placeholder": {
    en: "e.g. Same incident as the report filed at 10:42",
    tl: "hal. Parehong insidente ng ulat na naisumite nang 10:42",
  },
  "reason.note": { en: "Note", tl: "Tala" },
  "reason.noteOptional": { en: "optional", tl: "opsyonal" },
  "reason.noteRequired": { en: "required for Other", tl: "kailangan para sa Iba pa" },
  // English names come from REJECT_REASON_LABELS, which the CSV also uses.
  "rejectReason.wrong_category": { en: REJECT_REASON_LABELS.wrong_category, tl: "Maling kategorya" },
  "rejectReason.already_resolved": { en: REJECT_REASON_LABELS.already_resolved, tl: "Naayos na" },
  "rejectReason.mistaken_identity": { en: REJECT_REASON_LABELS.mistaken_identity, tl: "Maling pagkakakilanlan" },
  "rejectReason.not_an_emergency": { en: REJECT_REASON_LABELS.not_an_emergency, tl: "Hindi emergency" },
  "rejectReason.duplicate": { en: REJECT_REASON_LABELS.duplicate, tl: "Doble" },
  "rejectReason.other": { en: REJECT_REASON_LABELS.other, tl: "Iba pa" },
  "routing.routeToAgency": { en: "Route to agency", tl: "Ipasa sa ahensya" },
  "resolve.button": { en: "Resolve at barangay", tl: "Lutasin sa barangay" },
  "resolve.title": { en: "Resolve {id} at the barangay?", tl: "Lutasin ang {id} sa barangay?" },
  "resolve.description": {
    en: "Use this when your barangay handled the report itself. It is marked resolved without going to any agency, and this can't be undone from here.",
    tl: "Gamitin ito kapag ang barangay mismo ang umasikaso sa ulat. Mamarkahan itong nalutas nang hindi ipinapasa sa anumang ahensya, at hindi na ito mababawi mula rito.",
  },
  "resolve.noteLabel": { en: "What was done", tl: "Ano ang ginawa" },
  "resolve.notePlaceholder": {
    en: "e.g. Barangay maintenance cleared the drain.",
    tl: "hal. Nilinis ng maintenance ng barangay ang kanal.",
  },
  "resolve.confirm": { en: "Resolve report", tl: "Lutasin ang ulat" },
  "resolve.doneToast": {
    en: "{id} resolved at the barangay — moved to Validation History",
    tl: "Nalutas ang {id} sa barangay — inilipat sa Kasaysayan ng Pag-validate",
  },
  "resolve.failed": { en: "Couldn't resolve the report. Try again.", tl: "Hindi nalutas ang ulat. Subukang muli." },
  "routing.finish": { en: "Finish routing", tl: "Tapusin ang pagpasa" },
  "routing.routeElsewhere": { en: "Route to another agency", tl: "Ipasa sa ibang ahensya" },
  "routing.lead": { en: "(lead)", tl: "(pangunahin)" },
  "routing.agencyCountOne": { en: "1 agency", tl: "1 ahensya" },
  "routing.agencyCount": { en: "{count} agencies", tl: "{count} ahensya" },
  "routing.outcome.resolved": { en: "resolved", tl: "nalutas" },
  "routing.outcome.confirmed-false": { en: "confirmed false", tl: "kumpirmadong hindi totoo" },
  "routing.outcome.duplicate": { en: "duplicate", tl: "doble" },
  "routing.outcome.out-of-scope": { en: "out of scope", tl: "labas sa saklaw" },
  "routing.outcome.recalled": { en: "recalled", tl: "binawi" },
  // Written only by CDRRMO dispatch's reject after routing (backend spec
  // 3.4): CDRRMO rejected a report already routed, and the agency's row was
  // closed with it. Never an agency's own choice.
  "routing.outcome.rejected": { en: "rejected by CDRRMO", tl: "tinanggihan ng CDRRMO" },
  "routing.progress.closed": { en: "Closed — {outcome}", tl: "Isinara — {outcome}" },
  "routing.progress.acknowledged": { en: "Acknowledged", tl: "Kinilala na" },
  "routing.progress.inProgress": { en: "In progress", tl: "Inaasikaso na" },
  "routing.progress.awaiting": { en: "Awaiting acknowledgement", tl: "Naghihintay ng pagkilala" },
  "routing.summary.closedBy": {
    en: "Closed by {agency}{more} — {outcome}",
    tl: "Isinara ng {agency}{more} — {outcome}",
  },
  "routing.summary.resolvedBy": { en: "Resolved by {agency}{more}", tl: "Nalutas ng {agency}{more}" },
  "routing.summary.inProgressAt": {
    en: "In progress at {agency}{more}",
    tl: "Inaasikaso ng {agency}{more}",
  },
  "routing.summary.acknowledgedBy": {
    en: "Acknowledged by {agency}{more}",
    tl: "Kinilala ng {agency}{more}",
  },
  "routing.summary.returned": {
    en: "Returned by {agency}{more} — out of scope · handle it at the barangay",
    tl: "Ibinalik ng {agency}{more} — labas sa saklaw · asikasuhin sa barangay",
  },
  "routing.summary.resolvedOpen": {
    en: "Resolved by {agency} · {agencies} still open",
    tl: "Nalutas ng {agency} · {agencies} pa ang humahawak",
  },
  "routing.summary.returnedOpen": {
    en: "Returned by {agency} — out of scope · {agencies} still open",
    tl: "Ibinalik ng {agency} — labas sa saklaw · {agencies} pa ang humahawak",
  },
  "routing.summary.routedTo": {
    en: "Routed to {agency}{more} · awaiting acknowledgement",
    tl: "Naipasa sa {agency}{more} · naghihintay ng pagkilala",
  },
  "routing.finishTitle": { en: "Finish routing {id}?", tl: "Tapusin ang pagpasa ng {id}?" },
  "routing.finishDescription": {
    en:
      "A previous attempt sent this report to some agencies but didn't complete. " +
      "Finishing sends it to any agencies still missing and records the routing. " +
      "Agencies that already have it won't receive it twice.",
    tl:
      "Naipasa na ang ulat na ito sa ilang ahensya sa naunang pagtatangka, pero hindi ito " +
      "natapos. Ipapasa ito sa mga ahensyang wala pa nito at itatala ang pagpasa. Hindi na " +
      "ito matatanggap nang dalawang beses ng mga ahensyang mayroon na nito.",
  },
  "routing.routeTitle": { en: "Route {id} to {agencies}?", tl: "Ipasa ang {id} sa {agencies}?" },
  "routing.routeDescription": {
    en: "{names} will see it on their dashboards immediately. Routing can't be undone from this console.",
    tl: "Makikita agad ito ng {names} sa kanilang dashboard. Hindi na ito mababawi mula sa console na ito.",
  },
  "routing.mappedAgencies": { en: "The mapped agencies", tl: "mga nakatalagang ahensya" },
  "routing.discreetNote": {
    en: "The reporter asked for discreet reporting.",
    tl: "Humiling ang nag-ulat ng discreet na pag-uulat.",
  },
  "routing.routeConfirm": { en: "Route to {agencies}", tl: "Ipasa sa {agencies}" },
  "routing.routedToast": { en: "{id} routed to {agencies}", tl: "Naipasa ang {id} sa {agencies}" },
  "routing.failed": { en: "Couldn't route this report", tl: "Hindi naipasa ang ulat na ito" },
  // A server action's answer, worded here because it is a race the official
  // can act on (RouteResult.reason "lead-taken").
  "routing.leadTaken": {
    en: "Another official has just routed this report. Refresh to see where it went.",
    tl: "Naipasa na ng ibang opisyal ang ulat na ito. I-refresh para makita kung saan ito napunta.",
  },
  "reroute.title": { en: "Route {id} to another agency", tl: "Ipasa ang {id} sa ibang ahensya" },
  "reroute.description": {
    en:
      "{names} sent it back as out of scope. Choose who should handle it instead. " +
      "Routing can't be undone from this console.",
    tl:
      "Ibinalik ito ng {names} bilang labas sa saklaw. Piliin kung sino ang hahawak nito. " +
      "Hindi na ito mababawi mula sa console na ito.",
  },
  "reroute.legend": { en: "Agencies", tl: "Mga ahensya" },
  "reroute.leadHint": {
    en: "The first agency you choose leads. Agencies that already had this report aren't listed.",
    tl: "Ang unang ahensyang pipiliin mo ang mangunguna. Hindi nakalista ang mga ahensyang nagkaroon na ng ulat na ito.",
  },
  "reroute.chooseFirst": { en: "Choose an agency", tl: "Pumili ng ahensya" },
  // The agency picker a validated Other-report opens.
  "choose.title": { en: "Route {id} to agencies", tl: "Ipasa ang {id} sa mga ahensya" },
  "choose.description": {
    en: "Choose the agencies this report belongs to. Routing can't be undone from this console.",
    tl: "Piliin ang mga ahensyang may kinalaman sa ulat na ito. Hindi na mababawi ang pagpasa mula sa console na ito.",
  },
  "choose.descriptionSuggested": {
    en:
      "Choose the agencies this report belongs to. The ones its category maps to are ticked already; " +
      "change them if it belongs elsewhere. Routing can't be undone from this console.",
    tl:
      "Piliin ang mga ahensyang may kinalaman sa ulat na ito. Naka-tsek na ang mga nakatalaga sa kategorya nito; " +
      "palitan kung sa iba ito nababagay. Hindi na mababawi ang pagpasa mula sa console na ito.",
  },
  "choose.leadHint": {
    en: "The first agency ticked leads. You can choose more than one.",
    tl: "Ang unang ahensyang na-tsek ang mangunguna. Maaaring pumili ng higit sa isa.",
  },

  // --- Report detail drawer -------------------------------------------------
  "drawer.close": { en: "Close report details", tl: "Isara ang detalye ng ulat" },
  "drawer.tier.emergency": { en: "Emergency fast-triage", tl: "Emergency (mabilisang triage)" },
  "drawer.tier.other_reports": { en: "Standard intake", tl: "Karaniwang ulat" },
  "drawer.discreetBanner": {
    en: "Discreet report: do not call or text the reporter.",
    tl: "Discreet na ulat: huwag tawagan o i-text ang nag-ulat.",
  },
  "drawer.noDescription": { en: "No description provided.", tl: "Walang ibinigay na paglalarawan." },
  "drawer.notProvided": { en: "Not provided", tl: "Hindi ibinigay" },
  "drawer.section.reporterSaid": { en: "What the reporter said", tl: "Sinabi ng nag-ulat" },
  "drawer.severity": { en: "Severity (self-rated)", tl: "Kalubhaan (ayon sa nag-ulat)" },
  "drawer.anyoneHurt": { en: "Anyone hurt", tl: "May nasaktan ba" },
  "drawer.ongoing": { en: "Still ongoing", tl: "Nagpapatuloy pa" },
  "drawer.yes": { en: "Yes", tl: "Oo" },
  "drawer.no": { en: "No", tl: "Hindi" },
  "drawer.safetyNet": { en: "Safety-net confirmation", tl: "Kumpirmasyon ng safety net" },
  "drawer.attachments": { en: "Attachments", tl: "Mga kalakip" },
  "drawer.attach.both": { en: "Photo and video", tl: "Larawan at video" },
  "drawer.attach.photo": { en: "Photo", tl: "Larawan" },
  "drawer.attach.video": { en: "Video", tl: "Video" },
  "drawer.attach.none": { en: "No photo or video", tl: "Walang larawan o video" },
  "drawer.section.triage": { en: "Triage", tl: "Triage" },
  "drawer.priority": { en: "Priority", tl: "Priyoridad" },
  "drawer.subCategory": { en: "Sub-category", tl: "Sub-kategorya" },
  "drawer.notScoredYet": { en: "Not scored yet", tl: "Wala pang iskor" },
  "drawer.score": { en: "{priority} · score {score}", tl: "{priority} · iskor {score}" },
  "drawer.confidence": { en: "Confidence", tl: "Kumpiyansa" },
  "drawer.status": { en: "Status", tl: "Katayuan" },
  "drawer.cluster": { en: "Duplicate cluster", tl: "Kumpol ng doble" },
  "drawer.section.submission": { en: "Submission", tl: "Pagsumite" },
  "drawer.section.location": { en: "Location", tl: "Lokasyon" },
  "drawer.location.label": {
    en: "Map of where the reporter's phone was when they filed",
    tl: "Mapa kung saan naroon ang telepono ng nag-ulat nang magsampa",
  },
  "drawer.location.caption": {
    en: "Where the reporter's phone was when they filed, which may not be the exact spot of the incident: {lat}, {lng}. Street map from OpenStreetMap.",
    tl: "Kung saan naroon ang telepono ng nag-ulat nang magsampa, na maaaring hindi eksaktong lugar ng insidente: {lat}, {lng}. Galing sa OpenStreetMap ang mapa ng kalye.",
  },
  "drawer.location.none": { en: "This report carries no location.", tl: "Walang lokasyon ang ulat na ito." },
  "drawer.location.hidden": {
    en: "Not shown: the location of an identity-withheld or discreet report is never displayed.",
    tl: "Hindi ipinapakita: hindi kailanman ipinapakita ang lokasyon ng ulat na itinago ang pagkakakilanlan o discreet.",
  },
  "drawer.location.unavailable": {
    en: "The location couldn't be loaded.",
    tl: "Hindi na-load ang lokasyon.",
  },
  "drawer.location.failed": {
    en: "The map couldn't load. The coordinates below still give the position.",
    tl: "Hindi na-load ang mapa. Ibinibigay pa rin ng mga coordinate sa ibaba ang posisyon.",
  },
  "drawer.submitted": { en: "Submitted", tl: "Isinumite" },
  "drawer.section.routing": { en: "Agency routing", tl: "Pagpasa sa ahensya" },
  "drawer.plan.willRoute": { en: "Will route to", tl: "Ipapasa sa" },
  "drawer.choose.body": {
    en: "Choose which agencies this report belongs to when you route it.",
    tl: "Piliin kung aling mga ahensya ang may kinalaman sa ulat na ito kapag ipapasa mo ito.",
  },
  "drawer.choose.suggested": { en: "Suggested from its category", tl: "Mungkahi batay sa kategorya nito" },
  "drawer.preview.choose": {
    en: "After validation, you choose which agencies it goes to.",
    tl: "Pagkatapos ma-validate, ikaw ang pipili kung saang mga ahensya ito ipapasa.",
  },
  "drawer.preview.willRoute": {
    en: "After validation, routing sends it to",
    tl: "Pagkatapos ma-validate, ipapasa ito sa",
  },
  "drawer.preview.noMapping": {
    en: "No agency is mapped to this category — after validation it stays with the barangay.",
    tl: "Walang ahensyang nakatalaga sa kategoryang ito — pagkatapos ma-validate, mananatili ito sa barangay.",
  },
  "drawer.plan.finishing": {
    en: "Finishing sends it to all of",
    tl: "Kapag tinapos, ipapasa ito sa lahat ng sumusunod",
  },
  "drawer.plan.finishingHeld": {
    en: "Finishing records the routing to the agencies above. No other agency is added.",
    tl: "Kapag tinapos, itatala ang pagpasa sa mga ahensya sa itaas. Walang ibang ahensyang idaragdag.",
  },
  "drawer.returned": {
    en: "Every agency it was routed to sent it back as out of scope. Choose another agency, or handle it at the barangay.",
    tl: "Ibinalik ito ng lahat ng ahensyang pinagpasahan bilang labas sa saklaw. Pumili ng ibang ahensya, o asikasuhin ito sa barangay.",
  },
  "drawer.returnedEarlier": { en: "Returned earlier", tl: "Ibinalik noon" },
  "drawer.autoRouted": {
    en: "Routed automatically, without a review here.",
    tl: "Awtomatikong naipasa, nang walang pagsusuri dito.",
  },
  "drawer.returnedPending": {
    en: "Every agency it was routed to sent it back as out of scope, so it needs a review here. After validation, choose another agency for it.",
    tl: "Ibinalik ito ng lahat ng ahensyang pinagpasahan bilang labas sa saklaw, kaya kailangan itong suriin dito. Pagkatapos ma-validate, pumili ng ibang ahensya para rito.",
  },
  "drawer.incomplete": {
    en: "A routing attempt stopped part-way. These agencies already have it:",
    tl: "Huminto sa kalagitnaan ang isang pagtatangkang ipasa ito. Mayroon na nito ang mga ahensyang ito:",
  },
  "drawer.noMapping": {
    en: "No agency is mapped to this category, so it can't be routed from here. It needs barangay review.",
    tl: "Walang ahensyang nakatalaga sa kategoryang ito, kaya hindi ito maipapasa mula rito. Kailangan itong suriin ng barangay.",
  },
  "drawer.unavailable": {
    en: "Routing options couldn't be loaded. Refresh the page to try again.",
    tl: "Hindi na-load ang mga opsyon sa pagpasa. I-refresh ang page para subukang muli.",
  },
  "drawer.downstreamMissing": {
    en: "Routed, but the agency details couldn't be loaded. Refresh to try again.",
    tl: "Naipasa na, pero hindi na-load ang detalye ng ahensya. I-refresh para subukang muli.",
  },
  "drawer.footer.noMapping": {
    en: "No agency is mapped to this category — handle it at the barangay.",
    tl: "Walang ahensyang nakatalaga sa kategoryang ito — asikasuhin ito sa barangay.",
  },
  "drawer.footer.unavailable": {
    en: "Couldn't load routing options. Refresh to try again.",
    tl: "Hindi na-load ang mga opsyon sa pagpasa. I-refresh para subukang muli.",
  },
  "drawer.footer.downstream": {
    en: "With the agencies now — they update its progress, not this desk.",
    tl: "Nasa mga ahensya na ito — sila ang nag-a-update ng progreso, hindi ang desk na ito.",
  },
  "drawer.footer.returned": {
    en: "Returned by the agencies as out of scope — handle it at the barangay. This report can't be sent to another agency from here.",
    tl: "Ibinalik ng mga ahensya bilang labas sa saklaw — asikasuhin ito sa barangay. Hindi maipapasa ang ulat na ito sa ibang ahensya mula rito.",
  },
  "drawer.footer.optionsUnavailable": {
    en: "Couldn't load the agency list. Refresh to try again.",
    tl: "Hindi na-load ang listahan ng ahensya. I-refresh para subukang muli.",
  },
  "drawer.footer.noOtherAgency": {
    en: "Every agency has already had this report — handle it at the barangay.",
    tl: "Nagkaroon na ng ulat na ito ang lahat ng ahensya — asikasuhin ito sa barangay.",
  },
  "drawer.footer.reviewed": {
    en: "Already reviewed — no further action available here.",
    tl: "Nasuri na — wala nang ibang magagawa rito.",
  },
  "drawer.stage.closed": { en: "closed {time}", tl: "isinara {time}" },
  "drawer.stage.acknowledged": { en: "acknowledged {time}", tl: "kinilala {time}" },
  "drawer.stage.inProgress": { en: "in progress since {time}", tl: "inaasikaso mula {time}" },
  "drawer.stage.routed": { en: "routed {time}", tl: "naipasa {time}" },
  "drawer.sessionExpired": {
    en: "Your session expired. Sign in again.",
    tl: "Nag-expire ang iyong session. Mag-sign in muli.",
  },
  "drawer.notLogged": {
    en: "Opening this report wasn't recorded in the access log. Tell the pilot support desk.",
    tl: "Hindi naitala sa access log ang pagbukas mo sa ulat na ito. Ipaalam sa pilot support desk.",
  },

  // --- Validation History ---------------------------------------------------
  "history.tile.total": { en: "Total", tl: "Kabuuan" },
  "history.tile.confirmed": { en: "Confirmed", tl: "Kumpirmado" },
  "history.tile.rejected": { en: "Rejected", tl: "Tinanggihan" },
  "history.tile.withheld": { en: "Identity withheld", tl: "Nakatagong pagkakakilanlan" },
  "history.range.today": { en: "Today", tl: "Ngayong araw" },
  "history.range.7d": { en: "Last 7d", tl: "Nakaraang 7 araw" },
  "history.range.all": { en: "All time", tl: "Lahat" },
  "history.outcome.all": { en: "All outcomes", tl: "Lahat ng resulta" },
  "history.outcome.Confirmed": { en: "Confirmed", tl: "Kumpirmado" },
  "history.outcome.Rejected": { en: "Rejected", tl: "Tinanggihan" },
  "history.filterOutcome": { en: "Filter by outcome", tl: "Salain ayon sa resulta" },
  "history.filterOfficial": {
    en: "Filter by validating official",
    tl: "Salain ayon sa opisyal na nag-validate",
  },
  "history.allOfficials": { en: "All officials", tl: "Lahat ng opisyal" },
  "history.filterCategory": { en: "Filter by category", tl: "Salain ayon sa kategorya" },
  "history.allCategories": { en: "All categories", tl: "Lahat ng kategorya" },
  "history.filterPriority": { en: "Filter by priority", tl: "Salain ayon sa priyoridad" },
  "history.allPriorities": { en: "All priorities", tl: "Lahat ng priyoridad" },
  "history.filterResolution": { en: "Filter by resolution", tl: "Salain ayon sa kinahinatnan" },
  "history.allResolutions": { en: "All resolutions", tl: "Lahat ng kinahinatnan" },
  "history.resolution.notRouted": { en: "Not routed yet", tl: "Hindi pa naipapasa" },
  "history.resolution.resolvedAtBarangay": { en: "Resolved at the barangay", tl: "Nalutas sa barangay" },
  "history.resolution.withAgencies": { en: "With agencies", tl: "Nasa ahensya" },
  "history.resolution.resolved": { en: "Resolved by an agency", tl: "Nalutas ng ahensya" },
  "history.resolution.confirmedFalse": { en: "Confirmed false by an agency", tl: "Kinumpirmang mali ng ahensya" },
  "history.resolution.duplicate": { en: "Closed as a duplicate", tl: "Isinara bilang doble" },
  "history.resolution.returned": { en: "Returned out of scope", tl: "Ibinalik, labas sa saklaw" },
  "history.resolution.rejectedByCdrrmo": { en: "Rejected by CDRRMO after routing", tl: "Tinanggihan ng CDRRMO matapos maipasa" },
  "history.yourBarangay": { en: "Your barangay", tl: "Ang inyong barangay" },
  "history.resolution.overriddenByCdrrmo": {
    en: "Sent on by CDRRMO after your rejection",
    tl: "Ipinasa ng CDRRMO matapos ninyong tanggihan",
  },
  "history.export": { en: "Export CSV", tl: "I-export ang CSV" },
  "history.exportNothing": {
    en: "Nothing to export with these filters",
    tl: "Walang mai-e-export sa mga filter na ito",
  },
  "history.exported": { en: "Exported {count} records as CSV", tl: "Na-export ang {count} rekord bilang CSV" },
  "history.empty.filteredTitle": {
    en: "No records match these filters",
    tl: "Walang rekord na tumutugma sa mga filter na ito",
  },
  "history.empty.filteredBody": {
    en: "Try a wider date range, or clear the outcome and official filters.",
    tl: "Subukan ang mas malawak na petsa, o alisin ang filter ng resulta at opisyal.",
  },
  "history.empty.title": { en: "No validation records yet", tl: "Wala pang rekord ng pag-validate" },
  "history.empty.body": {
    en: "Records appear here once reports in your barangay's queue have been confirmed or rejected.",
    tl: "Lalabas dito ang mga rekord kapag nakumpirma o natanggihan na ang mga ulat sa pila ng inyong barangay.",
  },
  "history.caption": {
    en:
      "Reviewed reports: report, category and priority, verdict, validating official, " +
      "reporter, and time reviewed",
    tl:
      "Mga nasuring ulat: ulat, kategorya at priyoridad, pasya, opisyal na nag-validate, " +
      "nag-ulat, at oras ng pagsusuri",
  },
  "history.col.report": { en: "Report", tl: "Ulat" },
  "history.col.verdict": { en: "Verdict", tl: "Pasya" },
  "history.col.official": { en: "Validating official", tl: "Opisyal na nag-validate" },
  "history.tier.emergency": { en: "Emergency", tl: "Emergency" },
  "history.tier.other_reports": { en: "Standard intake", tl: "Karaniwang ulat" },
  "history.verdict.confirmed": { en: "Confirmed", tl: "Kumpirmado" },
  "history.verdict.rejected": { en: "Rejected", tl: "Tinanggihan" },
  "history.trust": { en: "({delta} trust)", tl: "({delta} tiwala)" },
  "history.footer.filtered": {
    en: "Showing {shown} of {total} loaded records",
    tl: "Ipinapakita ang {shown} sa {total} na-load na rekord",
  },
  "history.footer.all": {
    en: "Showing the {count} most recent reviewed reports for {barangay}",
    tl: "Ipinapakita ang {count} pinakabagong nasuring ulat ng {barangay}",
  },
  "history.footer.allOne": {
    en: "Showing the 1 most recent reviewed report for {barangay}",
    tl: "Ipinapakita ang 1 pinakabagong nasuring ulat ng {barangay}",
  },
  "history.footer.newest": { en: "newest first", tl: "pinakabago muna" },
  "history.footer.capped": {
    en: "capped at the {limit} most recent, so filters apply to those only",
    tl: "hanggang {limit} pinakabago lamang ang na-load, kaya sa mga iyon lang gumagana ang mga filter",
  },

  // --- Reports ----------------------------------------------------------------
  "reports.dailyTitle": { en: "Daily Queue Summary", tl: "Pang-araw-araw na Buod ng Pila" },
  "reports.dailyIntro": {
    en: "Reports submitted on the chosen day, by category, counted by where each one stands now.",
    tl: "Mga ulat na isinumite sa napiling araw, ayon sa kategorya, binilang ayon sa kasalukuyang katayuan ng bawat isa.",
  },
  "reports.date": { en: "Date", tl: "Petsa" },
  "reports.tile.submitted": { en: "Submitted", tl: "Naisumite" },
  "reports.tile.awaiting": { en: "Awaiting review", tl: "Naghihintay ng pagsusuri" },
  "reports.col.category": { en: "Category", tl: "Kategorya" },
  "reports.empty": { en: "No reports were submitted on {date}.", tl: "Walang ulat na naisumite noong {date}." },
  "reports.caption": {
    en: "Reports submitted on {date} by category: submitted, awaiting review, validated, and rejected",
    tl: "Mga ulat na naisumite noong {date} ayon sa kategorya: naisumite, naghihintay ng pagsusuri, na-validate, at tinanggihan",
  },
  "reports.footer": {
    en: "Days and times are Manila. A report submitted that day and decided later counts under its decision.",
    tl: "Araw at oras sa Maynila. Ang ulat na naisumite sa araw na iyon at napagpasyahan kalaunan ay binibilang ayon sa pasya.",
  },
  "reports.capped": {
    en: "Only the first {limit} reports of the day were counted.",
    tl: "Ang unang {limit} ulat lamang ng araw ang nabilang.",
  },
  "reports.exported": { en: "Exported the summary for {date} as CSV", tl: "Na-export ang buod ng {date} bilang CSV" },
  "reports.exportNothing": { en: "Nothing to export for this day", tl: "Walang mai-e-export para sa araw na ito" },
  "reports.weeklyTitle": {
    en: "Weekly False-Report Rate per Reporter",
    tl: "Lingguhang Bilang ng Maling Ulat bawat Nag-ulat",
  },
  "reports.weeklyUnavailable": {
    en:
      "Not generated in this console. It would list reporters by name beside the outcomes of " +
      "their reports, and the console never sets a named resident beside a report. A resident's " +
      "strikes are on the Sanctions page, for the barangay's admins.",
    tl:
      "Hindi ginagawa sa console na ito. Ililista nito ang mga nag-ulat ayon sa pangalan katabi ng " +
      "kinalabasan ng kanilang mga ulat, at hindi kailanman itinatabi ng console ang pangalan ng " +
      "residente sa isang ulat. Nasa page na Mga Parusa ang mga strike ng residente, para sa mga admin ng barangay.",
  },
  "print.button": { en: "Print or save as PDF", tl: "I-print o i-save bilang PDF" },
  "print.nothing": { en: "Nothing to print with these filters", tl: "Walang mai-pi-print sa mga filter na ito" },
  "print.changed": {
    en: "The page changed while the print was being recorded, so nothing was printed. Try again.",
    tl: "Nagbago ang page habang itinatala ang pag-print, kaya walang na-print. Subukang muli.",
  },
  "reports.resolution.title": {
    en: "Monthly Resolution Time by Agency",
    tl: "Buwanang Oras ng Paglutas bawat Ahensya",
  },
  "reports.resolution.intro": {
    en: "For each agency, how long this barangay's reports took from routing to resolution, over the routings it closed in the chosen month.",
    tl: "Para sa bawat ahensya, gaano katagal ang mga ulat ng barangay na ito mula sa pagpasa hanggang sa paglutas, sa mga pagpasang isinara nito sa napiling buwan.",
  },
  "reports.resolution.month": { en: "Month", tl: "Buwan" },
  "reports.resolution.col.time": { en: "Routing to resolution", tl: "Mula pagpasa hanggang paglutas" },
  "reports.resolution.caption": {
    en: "Resolution time per agency for {month}: resolved, routing to resolution, returned out of scope",
    tl: "Oras ng paglutas bawat ahensya para sa {month}: nalutas, mula pagpasa hanggang paglutas, ibinalik bilang labas sa saklaw",
  },
  "reports.resolution.empty": {
    en: "No agency closed a report from this barangay in {month}.",
    tl: "Walang ahensyang nagsara ng ulat mula sa barangay na ito noong {month}.",
  },
  "reports.resolution.failed": {
    en: "The monthly resolution times couldn't load. Refresh the page; the daily summary above isn't affected.",
    tl: "Hindi na-load ang buwanang oras ng paglutas. I-refresh ang page; hindi apektado ang buod ng araw sa itaas.",
  },
  "reports.resolution.footer": {
    en: "Months and times are Manila. The clock starts when the report was routed. Reports returned out of scope are counted apart and kept out of the time. The 95th percentile appears once an agency has {min} timings.",
    tl: "Buwan at oras sa Maynila. Nagsisimula ang orasan nang maipasa ang ulat. Hiwalay na binibilang ang mga ibinalik bilang labas sa saklaw at hindi isinasama sa oras. Lumalabas ang ika-95 na percentile kapag may {min} nang naorasan ang ahensya.",
  },
  "reports.resolution.capped": {
    en: "Only the first {limit} closures of the month were counted.",
    tl: "Ang unang {limit} pagsasara lamang ng buwan ang nabilang.",
  },
  "reports.resolution.exported": {
    en: "Exported the resolution times for {month} as CSV",
    tl: "Na-export ang oras ng paglutas para sa {month} bilang CSV",
  },
  "reports.resolution.exportNothing": {
    en: "Nothing to export for this month",
    tl: "Walang mai-e-export para sa buwang ito",
  },
  "reports.catalogue.title": {
    en: "Other barangay reports in the thesis",
    tl: "Iba pang ulat ng barangay sa tesis",
  },
  "reports.catalogue.intro": {
    en: "The thesis's report catalogue also lists these for the barangay. Each is shown with the reason it isn't generated here.",
    tl: "Nakalista rin sa katalogo ng ulat ng tesis ang mga ito para sa barangay. Ipinapakita ang bawat isa kasama ang dahilan kung bakit hindi ito nabubuo rito.",
  },
  "reports.cadence.weekly": { en: "weekly", tl: "lingguhan" },
  "reports.cadence.monthly": { en: "monthly", tl: "buwanan" },
  "reports.catalogue.15.title": {
    en: "Weekly Safety-Net Trigger Summary",
    tl: "Lingguhang Buod ng mga Na-trigger na Safety-Net",
  },
  "reports.catalogue.15.status": {
    en: "Not built: it counts each time a safety-net rule fired, and those events aren't recorded anywhere this console can read.",
    tl: "Hindi nabuo: binibilang nito ang bawat pag-trigger ng isang safety-net na tuntunin, at hindi naitatala ang mga iyon kahit saan na nababasa ng console na ito.",
  },
  "reports.catalogue.17.title": {
    en: "Monthly Resident Engagement Summary",
    tl: "Buwanang Buod ng Pakikilahok ng Residente",
  },
  "reports.catalogue.17.status": {
    en: "Not built: it counts activity per resident, and this console never reads who a reporter is.",
    tl: "Hindi nabuo: binibilang nito ang aktibidad bawat residente, at hindi kailanman binabasa ng console na ito kung sino ang nag-ulat.",
  },
  "reports.catalogue.18.title": { en: "Monthly Override-Recall Usage", tl: "Buwanang Paggamit ng Recall" },
  "reports.catalogue.18.status": {
    en: "Not available: the queue now offers Recall on reports routed automatically, but the desk's audit log doesn't include recalls yet, so there is nothing to count here.",
    tl: "Hindi available: may Recall na sa pila para sa mga ulat na awtomatikong naipasa, pero wala pang pagbawi sa audit log ng desk, kaya walang mabibilang dito.",
  },

  // --- Cluster Explorer (empty state only; see ClusterExplorerClient) -------
  "cluster.mixedCategories": { en: "Mixed categories", tl: "Magkakaibang kategorya" },
  "cluster.confirm.mixed": {
    en: "The reports in this group have different categories ({categories}). Check that each one is genuine before validating them together.",
    tl: "Magkakaiba ang kategorya ng mga ulat sa pangkat na ito ({categories}). Tiyaking totoo ang bawat isa bago i-validate nang sabay.",
  },
  "queue.dupGroup.title": { en: "Duplicate group · {count} reports", tl: "Pangkat ng doble · {count} ulat" },
  "queue.dupGroup.done": {
    en: "All validated. They move to Recent validated.",
    tl: "Na-validate lahat. Lilipat ang mga ito sa Kamakailang Na-validate.",
  },
  "cluster.card.inBarangay": { en: "{count} reports in {barangay}", tl: "{count} ulat sa {barangay}" },
  "cluster.card.acrossBarangays": { en: "{count} reports across {barangays} barangays", tl: "{count} ulat mula sa {barangays} barangay" },
  "cluster.card.withheld": { en: "· {count} identity-withheld", tl: "· {count} nakatago ang pagkakakilanlan" },
  "cluster.card.validate": { en: "Validate as one cluster", tl: "I-validate bilang isang kumpol" },
  "cluster.card.done": { en: "— all {count} reports validated. They move to Recent validated.", tl: "— na-validate ang lahat ng {count} ulat. Lilipat ang mga ito sa Kamakailang Na-validate." },
  "cluster.toast.all": { en: "Validated all {count} reports in {id}", tl: "Na-validate ang lahat ng {count} ulat sa {id}" },
  "cluster.toast.partial": { en: "Validated {validated} of {total} — {failed} could not be validated", tl: "Na-validate ang {validated} sa {total} — hindi na-validate ang {failed}" },
  "cluster.toast.failed": { en: "Could not validate this cluster", tl: "Hindi ma-validate ang kumpol na ito" },
  "cluster.confirm.title": { en: "Validate all {count} reports in {id}?", tl: "I-validate ang lahat ng {count} ulat sa {id}?" },
  "cluster.confirm.body": { en: "Each report is validated individually. Any that another official has already reviewed will be skipped and reported back.", tl: "Isa-isang iva-validate ang bawat ulat. Lalaktawan ang anumang nasuri na ng ibang opisyal, at sasabihin kung alin." },
  "cluster.confirm.label": { en: "Validate {count} reports", tl: "I-validate ang {count} ulat" },
  "cluster.list.title": { en: "Clusters · {count}", tl: "Mga kumpol · {count}" },
  "cluster.list.members": { en: "{count} members", tl: "{count} kasapi" },
  "cluster.list.radius": { en: " · {meters}m radius", tl: " · {meters}m radius" },
  "cluster.status.standard": { en: "Standard", tl: "Karaniwan" },
  "cluster.member.title": { en: "{id} · {category}, {count} reports clustered", tl: "{id} · {category}, {count} ulat sa kumpol" },
  "cluster.member.where": { en: "Validate members from the Queue", tl: "I-validate ang mga kasapi mula sa Pila ng Ulat" },
  "cluster.member.primary": { en: "Primary", tl: "Pangunahin" },
  "cluster.member.related": { en: "Related", tl: "Kaugnay" },
  "cluster.signal.visualHash": { en: "Visual hash {value}", tl: "Visual hash {value}" },
  "cluster.signal.temporal": { en: "Temporal Δ {minutes}m {seconds}s", tl: "Agwat sa oras {minutes}m {seconds}s" },
  "cluster.signal.sitio": { en: "{sitio} radius", tl: "Radius ng {sitio}" },
  "cluster.map.title": { en: "Member locations", tl: "Lokasyon ng mga miyembro" },
  "cluster.map.aria": { en: "Map of this cluster's members", tl: "Mapa ng mga miyembro ng kumpol na ito" },
  "cluster.map.area": { en: "Barangay: {name}", tl: "Barangay: {name}" },
  "cluster.map.shown": {
    en: "{shown} of {total} members have a usable location.",
    tl: "{shown} sa {total} na miyembro ang may magagamit na lokasyon.",
  },
  "cluster.map.hiddenNote": {
    en: "{count} without a map, by design: identity withheld or discreet reporting.",
    tl: "{count} walang mapa, sinadya: nakatago ang pagkakakilanlan o discreet reporting.",
  },
  "cluster.map.missingNote": {
    en: "{count} with no usable position — no GPS fix, or the lookup failed.",
    tl: "{count} walang magagamit na posisyon — walang GPS fix, o hindi na-load.",
  },
  "cluster.map.noneUsable": {
    en: "None of this cluster's members have a usable location.",
    tl: "Walang miyembro ng kumpol na ito na may magagamit na lokasyon.",
  },
  "cluster.map.tapHint": {
    en: "Tap a dot to see that report's details in the list.",
    tl: "Pindutin ang tuldok para makita ang detalye ng ulat na iyon sa listahan.",
  },
  "cluster.map.nearby": {
    en: "{count} reports at this spot — pick one",
    tl: "{count} ulat sa lugar na ito — pumili ng isa",
  },
  "cluster.member.submitted": { en: "Filed", tl: "Isinumite" },
  "cluster.member.location": { en: "Location", tl: "Lokasyon" },
  "cluster.member.locationHidden": {
    en: "Not shown: identity withheld or discreet reporting.",
    tl: "Hindi ipinapakita: nakatago ang pagkakakilanlan o discreet reporting.",
  },
  "cluster.member.locationNone": { en: "No usable location on this report.", tl: "Walang magagamit na lokasyon ang ulat na ito." },
  "cluster.member.locationUnavailable": { en: "Couldn't load the location.", tl: "Hindi na-load ang lokasyon." },
  "cluster.member.decide": { en: "Decide", tl: "Magpasya" },
  "cluster.member.decideBody": {
    en: "Validate or reject this report from the Queue; the resident's description is shown there.",
    tl: "I-validate o tanggihan ang ulat na ito mula sa Pila ng Ulat; doon ipinapakita ang paglalarawan ng residente.",
  },
  "map.expand": { en: "Expand map", tl: "Palakihin ang mapa" },
  "map.collapse": { en: "Close the expanded map", tl: "Isara ang pinalaking mapa" },
  "cluster.map.loading": { en: "Loading map…", tl: "Nilo-load ang mapa…" },
  "cluster.map.failed": { en: "Couldn't load the map.", tl: "Hindi na-load ang mapa." },
  "clusters.emptyTitle": {
    en: "Duplicate detection isn't connected yet",
    tl: "Hindi pa nakakonekta ang pagtukoy ng doble",
  },
  "clusters.emptyBody": {
    en:
      "Reports aren't being grouped into clusters yet, so this page stays empty — that " +
      "doesn't mean there are no duplicates. Once grouping is switched on, clusters of two " +
      "or more related reports will appear here. Reports sent without a location, including " +
      "every identity-withheld report, can't be grouped, and only reports from the same " +
      "barangay, filed within 72 hours of each other, are compared.",
    tl:
      "Hindi pa pinagsasama-sama ang mga ulat sa mga kumpol, kaya walang laman ang page na " +
      "ito — hindi ibig sabihin nito na walang dobleng ulat. Kapag binuksan na ang " +
      "pagsasama-sama, lalabas dito ang mga kumpol ng dalawa o higit pang magkakaugnay na " +
      "ulat. Hindi maisasama ang mga ulat na walang lokasyon, kasama ang bawat ulat na " +
      "nakatago ang pagkakakilanlan, at ang mga ulat lang mula sa iisang barangay, na " +
      "naipadala sa loob ng 72 oras ng isa't isa, ang pinaghahambing.",
  },
  // Shown instead of the two above once DUPLICATE_WRITEBACK_LIVE is on.
  "clusters.emptyTitleLive": {
    en: "No duplicate groups right now",
    tl: "Walang pangkat ng dobleng ulat sa ngayon",
  },
  "clusters.emptyBodyLive": {
    en:
      "Pending reports the system judges to be the same incident are grouped here " +
      "automatically. It compares reports from the same barangay filed within 72 hours of " +
      "each other, weighing how close they are in place and time and their category, so " +
      "reports in different categories can still be grouped. Reports sent without a location, " +
      "including every identity-withheld report, are left out of grouping. The grouping is " +
      "the system's and can't be changed from this console.",
    tl:
      "Awtomatikong pinagsasama-sama rito ang mga nakabinbing ulat na itinuring ng sistema " +
      "na iisang insidente. Pinaghahambing nito ang mga ulat mula sa iisang barangay na " +
      "naipadala sa loob ng 72 oras ng isa't isa, ayon sa lapit ng lugar at oras at sa " +
      "kategorya, kaya maaaring mapagsama ang mga ulat na magkaiba ang kategorya. Hindi " +
      "isinasama sa pagpapangkat ang mga ulat na naipadala nang walang lokasyon, kasama ang " +
      "bawat ulat na nakatago ang pagkakakilanlan. Ang sistema ang nagpapangkat, at hindi ito " +
      "mababago mula sa console na ito.",
  },

  // --- Audit Log (sample page) ----------------------------------------------
  "audit.notice": {
    en:
      "Recorded by the system when a report is opened, validated, rejected or routed. " +
      "It names roles, never officials: the trail this console can read leaves out who " +
      "did it, and the reporter's identity is never in it. · Talaan ng paggamit.",
    tl:
      "Itinatala ng sistema kapag binuksan, na-validate, tinanggihan o naipasa ang isang " +
      "ulat. Tungkulin ang ipinapakita, hindi ang pangalan ng opisyal, at wala rito ang " +
      "pagkakakilanlan ng nag-ulat.",
  },
  "audit.footer": {
    en: "Showing the newest {count} events of at most {limit}. The filters above apply to these.",
    tl: "Ipinapakita ang pinakabagong {count} pangyayari, hanggang {limit}. Sa mga ito lang tumutukoy ang mga filter sa itaas.",
  },
  "audit.footerFiltered": {
    en: "Showing {shown} of the newest {count} events. The filter applies to these, not to the whole trail.",
    tl: "Ipinapakita ang {shown} sa pinakabagong {count} pangyayari. Sa mga ito tumutukoy ang filter, hindi sa buong talaan.",
  },
  "audit.tile.total": { en: "Events shown", tl: "Mga pangyayaring ipinapakita" },
  "audit.tile.decisions": { en: "Decisions", tl: "Mga pasya" },
  "audit.tile.routings": { en: "Routings", tl: "Mga pagpapasa" },
  "audit.tile.openings": { en: "Report openings", tl: "Pagbukas ng ulat" },
  "audit.filter.all": { en: "All events", tl: "Lahat ng pangyayari" },
  "audit.filter.decisions": { en: "Decisions", tl: "Mga pasya" },
  "audit.filter.routings": { en: "Routings", tl: "Mga pagpapasa" },
  "audit.filter.openings": { en: "Report openings", tl: "Pagbukas ng ulat" },
  "audit.filterNote": {
    en: "Filters the events loaded below",
    tl: "Sinasala ang mga pangyayaring naka-load sa ibaba",
  },
  "audit.empty.title": { en: "No audit events yet", tl: "Wala pang audit na pangyayari" },
  "audit.empty.body": {
    en: "Opening, validating, rejecting or routing a report writes one here.",
    tl: "Ang pagbukas, pag-validate, pagtanggi o pagpapasa ng ulat ay nagdaragdag dito.",
  },
  "audit.empty.filtered": {
    en: "No events match these filters among the ones loaded.",
    tl: "Walang pangyayaring tugma sa mga filter na ito sa mga naka-load.",
  },
  "audit.filterRange": { en: "Date range", tl: "Saklaw ng petsa" },
  "audit.refusal.noRole": {
    en: "This account has no barangay role, so there is no trail to show for it.",
    tl: "Walang tungkulin sa barangay ang account na ito, kaya walang talaang maipapakita.",
  },
  "audit.refusal.noBarangay": {
    en:
      "This account isn't assigned to a barangay yet, so there is no trail to show. Tell the " +
      "pilot support desk.",
    tl:
      "Wala pang nakatalagang barangay ang account na ito, kaya walang talaang maipapakita. " +
      "Ipaalam sa pilot support desk.",
  },
  "audit.readOnly": {
    en: "Read-only. Every entry is appended by the system; nothing here can be edited or removed.",
    tl: "Pambasa lamang. Idinaragdag ng sistema ang bawat tala; wala ritong maaaring baguhin o burahin.",
  },
  "audit.caption": {
    en: "Audit events for this barangay's reports, newest first",
    tl: "Mga audit na pangyayari sa mga ulat ng barangay na ito, pinakabago muna",
  },
  "audit.col.action": { en: "Action", tl: "Aksyon" },
  "audit.col.role": { en: "Role", tl: "Tungkulin" },
  "audit.col.report": { en: "Report", tl: "Ulat" },
  "audit.action.report_viewed": { en: "Report opened", tl: "Binuksan ang ulat" },
  "audit.action.report_validated": { en: "Validated", tl: "Na-validate" },
  "audit.action.report_rejected": { en: "Rejected", tl: "Tinanggihan" },
  "audit.action.report_routed_manual": { en: "Routed to agencies", tl: "Naipasa sa mga ahensya" },
  "audit.action.report_auto_routed": { en: "Routed automatically", tl: "Awtomatikong naipasa" },
  "audit.action.routing_in_progress": { en: "In progress at an agency", tl: "Inaasikaso ng ahensya" },
  "audit.action.report_resolved_by_agencies": { en: "Resolved by agencies", tl: "Nalutas ng mga ahensya" },
  "audit.action.report_resolved_at_barangay": { en: "Resolved at the barangay", tl: "Nalutas sa barangay" },
  "audit.action.report_returned_to_barangay": { en: "Returned to barangay", tl: "Ibinalik sa barangay" },
  // Shown only on the city access log, which reads the whole trail.
  "audit.action.report_status_changed": { en: "Status changed", tl: "Nabago ang status" },
  "audit.action.identity_reveal": { en: "Identity revealed", tl: "Inilantad ang pagkakakilanlan" },
  "audit.action.report_submitted": { en: "Report submitted", tl: "Nagsumite ng ulat" },
  "audit.action.resident_sanction_lifted": { en: "Sanction lifted", tl: "Inalis ang parusa" },
  "audit.action.profile_scope_changed": { en: "Account role or barangay changed", tl: "Nabago ang role o barangay ng account" },
  // Written by the report chat for a message in either direction; the role
  // column says whether a resident or an official sent it.
  "audit.action.report_message_sent": { en: "Message sent on the report", tl: "Nagpadala ng mensahe sa ulat" },
  // Backend events seen on the city access log (2026-10-11). A resident's
  // consent, the clean-up job's removal of media fingerprints, an in-person
  // verification, and a trust score update.
  "audit.action.consent_granted": { en: "Consent given", tl: "Nagbigay ng pahintulot" },
  "audit.action.media_phashes_purged": { en: "Media fingerprints cleared", tl: "Binura ang mga fingerprint ng media" },
  "audit.action.resident_attested_tier1": { en: "Resident verified (Tier 1)", tl: "Na-verify ang residente (Tier 1)" },
  "audit.action.trust_score_changed": { en: "Trust score changed", tl: "Nabago ang trust score" },
  // CDRRMO dispatch's own events (backend spec 3.2-3.5). Never shown as the
  // barangay's report_validated / report_rejected.
  "audit.action.report_validated_cdrrmo": { en: "Validated by CDRRMO", tl: "Na-validate ng CDRRMO" },
  "audit.action.report_rejected_cdrrmo": { en: "Rejected by CDRRMO", tl: "Tinanggihan ng CDRRMO" },
  "audit.action.report_reject_overridden_cdrrmo": {
    en: "Barangay rejection overturned by CDRRMO",
    tl: "Binawi ng CDRRMO ang pagtanggi ng barangay",
  },
  "audit.action.report_agencies_added_cdrrmo": { en: "Agencies added by CDRRMO", tl: "Nagdagdag ng ahensya ang CDRRMO" },
  // Written by the cdrrmo-media stream for CDRRMO before routing and, since
  // the PR A binding item 17, for any routed agency too: worded for both.
  "audit.action.cdrrmo_media_view": { en: "Report media viewed by an agency", tl: "Tiningnan ng ahensya ang media ng ulat" },
  "audit.reportGone": { en: "Report no longer in the database", tl: "Wala na sa database ang ulat" },
  "role.municipal_admin": { en: "Municipal Admin", tl: "Municipal Admin" },
  "role.agency_user": { en: "Agency staff", tl: "Kawani ng ahensya" },
  "role.agency_supervisor": { en: "Agency supervisor", tl: "Superbisor ng ahensya" },
  "role.dpo": { en: "Data Protection Officer", tl: "Data Protection Officer" },
  "role.resident": { en: "Resident", tl: "Residente" },

  // --- Settings -------------------------------------------------------------
  "settings.nav.profile": { en: "Profile", tl: "Profile" },
  "settings.nav.language": { en: "Language", tl: "Wika" },
  "settings.nav.notifications": { en: "Notifications", tl: "Mga Abiso" },
  "settings.nav.privacy": { en: "Privacy & data rights", tl: "Privacy at karapatan sa datos" },
  "settings.nav.about": { en: "About / Support", tl: "Tungkol / Suporta" },
  "settings.privacy.subtitle": {
    en: "RA 10173 Data Privacy Act controls for records within your barangay scope.",
    tl: "Mga kontrol ng RA 10173 (Data Privacy Act) para sa mga rekord na sakop ng inyong barangay.",
  },
  "settings.privacy.exports": {
    en: "Exports respect Row-Level Security — you can only export records from your own barangay.",
    tl:
      "Sumusunod ang pag-export sa Row-Level Security — mga rekord lamang ng sarili ninyong " +
      "barangay ang maaari ninyong i-export.",
  },
  "settings.privacy.withheld": {
    en: "Identity-withheld reports never expose the reporter's name in any surface you can access.",
    tl:
      "Hindi kailanman ipinapakita ang pangalan ng nag-ulat sa mga ulat na nakatago ang " +
      "pagkakakilanlan, saanmang bahagi ng console.",
  },
  "settings.privacy.attestations": {
    en: "Tier 1 attestations store the event only — no government ID, ID number, or biometric data is retained.",
    tl:
      "Ang pangyayari lamang ang itinatala ng mga Tier 1 attestation — walang government ID, " +
      "numero ng ID, o biometric na datos na itinatago.",
  },
  "settings.about.body": {
    en:
      "For platform issues, contact the LipaAction pilot support desk at CDRRMO Lipa City. " +
      "For account or role-grant questions, contact your Punong Barangay.",
    tl:
      "Para sa mga problema sa platform, makipag-ugnayan sa LipaAction pilot support desk sa " +
      "CDRRMO Lipa City. Para sa mga tanong tungkol sa account o role, makipag-ugnayan sa " +
      "inyong Punong Barangay.",
  },
  "profile.editName": { en: "Edit display name", tl: "Baguhin ang pangalang ipinapakita" },
  "profile.nameLabel": { en: "Display name", tl: "Pangalang ipinapakita" },
  "profile.nameDescription": {
    en: "This is the name shown on reports you validate or reject, and in your barangay's audit trail.",
    tl:
      "Ito ang pangalang lumalabas sa mga ulat na iyong vina-validate o tinatanggihan, at sa " +
      "audit trail ng inyong barangay.",
  },
  "profile.email": { en: "Email", tl: "Email" },
  "profile.phone": { en: "Phone", tl: "Telepono" },
  "profile.notSet": { en: "Not set", tl: "Wala pa" },
  "profile.askAdmin": {
    en: "Ask a municipal admin to change this",
    tl: "Humiling sa municipal admin para baguhin ito",
  },
  "profile.askSystemAdmin": {
    en: "Ask the system's administrator to change this",
    tl: "Humiling sa administrator ng sistema para baguhin ito",
  },
  "profile.nameDescriptionCity": {
    en: "This is the name the city access log shows beside every report you open.",
    tl: "Ito ang pangalang ipinapakita ng talaan ng access ng lungsod sa tabi ng bawat ulat na binubuksan mo.",
  },
  "profile.nameUnconfirmed": {
    en: "Couldn't confirm your name was saved. Try again.",
    tl: "Hindi makumpirma kung na-save ang iyong pangalan. Subukang muli.",
  },
  "profile.nameUpdated": { en: "Display name updated", tl: "Na-update ang pangalang ipinapakita" },
  "profile.nameFailed": { en: "Couldn't update display name", tl: "Hindi na-update ang pangalang ipinapakita" },
  "language.title": { en: "Language preferences", tl: "Mga kagustuhan sa wika" },
  "language.body": {
    en:
      "Saved in this browser only · Naka-save sa device na ito. Interface language switches " +
      "the console's menus, buttons, and messages between English and Tagalog — the same " +
      "choice as the EN/TL switch at the top of every page. Reports are always shown exactly " +
      "as the resident wrote them. Some labels that come from the system — report " +
      "categories, priority levels, times, and some error messages — are still in English, " +
      "as are the sign-in and error pages.",
    tl:
      "Naka-save lamang sa browser na ito. Pinapalitan ng wika ng interface ang mga menu, " +
      "button, at mensahe ng console sa pagitan ng Ingles at Tagalog — kapareho ng EN/TL na " +
      "switch sa itaas ng bawat page. Ipinapakita palagi ang mga ulat nang eksakto kung paano " +
      "isinulat ng residente. Nasa Ingles pa ang ilang label na galing sa sistema — mga " +
      "kategorya ng ulat, antas ng priyoridad, oras, at ilang mensahe ng error — pati ang mga " +
      "page ng pag-sign in at ng error.",
  },
  "language.interface": { en: "Interface language", tl: "Wika ng interface" },
  "language.option.en": { en: "English", tl: "Ingles" },
  "language.option.tl": { en: "Tagalog (Filipino)", tl: "Tagalog (Filipino)" },
  "language.emphasis": { en: "Bilingual emphasis", tl: "Diin sa dalawang wika" },
  "language.emphasisNote": {
    en: "Recorded for a later version — it doesn't change the screens yet.",
    tl: "Itinatala para sa susunod na bersyon — hindi pa nito binabago ang mga screen.",
  },
  "language.emphasis.english-first": { en: "English first", tl: "Ingles muna" },
  "language.emphasis.tagalog-first": { en: "Tagalog first", tl: "Tagalog muna" },
  "language.emphasis.english-only": { en: "English only", tl: "Ingles lamang" },
  "notifications.body": {
    en:
      "Saved in this browser only · Naka-save sa device na ito. Alerts fire while the Queue " +
      "page is open in this browser; nothing is sent when the console is closed.",
    tl:
      "Naka-save lamang sa browser na ito. Gumagana ang mga alerto habang bukas ang Pila ng " +
      "Ulat sa browser na ito; walang ipinapadala kapag nakasara ang console.",
  },
  "notifications.audible": {
    en: "Audible alert for new Tier 0 emergencies",
    tl: "Tunog na alerto para sa bagong Tier 0 na emergency",
  },
  "notifications.audibleBody": {
    en: "Plays a short chime when a new fast-triage report arrives while the Queue is open.",
    tl: "Tumutunog nang maikli kapag may dumating na bagong ulat sa mabilisang triage habang bukas ang Pila.",
  },
  "notifications.testSound": { en: "Play test sound", tl: "Patugtugin ang pansubok na tunog" },
  "notifications.sla": { en: "SLA breach browser notification", tl: "Abiso sa browser kapag lumampas sa SLA" },
  "notifications.slaBody": {
    en:
      "Shows a browser notification when a Tier 0 report has waited more than 5 minutes " +
      "without a decision. Your browser will ask for permission the first time.",
    tl:
      "Nagpapakita ng abiso sa browser kapag may Tier 0 na ulat na naghintay nang higit sa 5 " +
      "minuto nang walang pasya. Hihingi ng pahintulot ang iyong browser sa unang pagkakataon.",
  },
  "notifications.unsupported": {
    en: "This browser doesn't support notifications",
    tl: "Hindi sumusuporta sa mga abiso ang browser na ito",
  },
  "notifications.blocked": {
    en: "Notifications are blocked for this site in your browser settings",
    tl: "Naka-block ang mga abiso para sa site na ito sa settings ng iyong browser",
  },
  "notifications.quietPrompt": {
    en: "Waiting for your browser. If no prompt appeared, click the bell icon in the address bar and choose Allow.",
    tl: "Hinihintay ang iyong browser. Kung walang lumabas na tanong, i-click ang icon ng kampana sa address bar at piliin ang Allow.",
  },
  "notifications.notAllowed": {
    en: "Notifications weren't allowed, so the switch stays off. Turn it on again to be asked again.",
    tl: "Hindi pinayagan ang mga abiso, kaya nananatiling naka-off ang switch. I-on itong muli para tanungin ka ulit.",
  },

  // --- City dashboard (municipal_admin) --------------------------------------
  "shell.cityConsoleName": { en: "City console", tl: "Console ng Lungsod" },
  "city.scope": { en: "Lipa City", tl: "Lungsod ng Lipa" },
  "nav.cityOverview": { en: "Overview", tl: "Pangkalahatang-tanaw" },
  "nav.cityResponse": { en: "Agency response", tl: "Tugon ng ahensya" },
  "nav.cityReports": { en: "Reports", tl: "Mga Ulat" },
  "nav.cityAgencies": { en: "Agencies", tl: "Mga Ahensya" },
  "nav.cityMap": { en: "Map", tl: "Mapa" },
  "nav.cityAccessLog": { en: "Access log", tl: "Talaan ng access" },
  "banner.what.cityAccessLog": { en: "The access log", tl: "talaan ng access" },
  "city.access.title": { en: "Who opened and acted on reports", tl: "Sino ang nagbukas at kumilos sa mga ulat" },
  "city.access.intro": {
    en: "Every recorded opening, decision and routing across the city, newest first, with the official who did it. Residents are never named. Opening this page is itself recorded.",
    tl: "Bawat naitalang pagbukas, pasya at pagpasa sa buong lungsod, pinakabago muna, kasama ang opisyal na gumawa nito. Hindi kailanman pinangangalanan ang mga residente. Itinatala rin ang pagbukas ng pahinang ito.",
  },
  "city.access.filter": { en: "Kind of event", tl: "Uri ng pangyayari" },
  "city.access.kind.routing": { en: "Routing and agencies", tl: "Pagpasa at mga ahensya" },
  "city.access.kind.exports": { en: "Exports", tl: "Mga export" },
  "city.access.kind.other": { en: "Other", tl: "Iba pa" },
  "city.access.tile.officials": { en: "Officials in these events", tl: "Mga opisyal sa mga pangyayaring ito" },
  "city.access.caption": {
    en: "Recorded events on reports across the city, with the official behind each",
    tl: "Mga naitalang pangyayari sa mga ulat sa buong lungsod, kasama ang opisyal sa likod ng bawat isa",
  },
  "city.access.col.who": { en: "Official", tl: "Opisyal" },
  "city.access.resident": { en: "Resident, not named", tl: "Residente, hindi pinangangalanan" },
  "city.access.system": { en: "System, automatic", tl: "Sistema, awtomatiko" },
  "city.access.notNamed": { en: "Not named", tl: "Hindi pinangangalanan" },
  "city.access.nameUnavailable": { en: "Name unavailable", tl: "Hindi makuha ang pangalan" },
  "city.access.unnamed": { en: "Unnamed official", tl: "Opisyal na walang pangalan" },
  "city.access.action.opened": { en: "Access log opened", tl: "Binuksan ang talaan ng access" },
  "city.access.empty": { en: "No events have been recorded yet.", tl: "Wala pang naitalang pangyayari." },
  "city.access.emptyFiltered": {
    en: "No events of this kind have been recorded.",
    tl: "Walang naitalang pangyayari na ganitong uri.",
  },
  "city.access.footer": {
    en: "{count} shown, newest first. Names and offices are as they are now; the role is the one recorded with each event.",
    tl: "{count} ang ipinapakita, pinakabago muna. Ang mga pangalan at tanggapan ay ayon sa kasalukuyan; ang tungkulin ay ang naitala kasama ng bawat pangyayari.",
  },
  "city.access.capped": {
    en: "Only the newest {limit} are read; choose a kind of event or a range of dates to see older ones.",
    tl: "Ang pinakabagong {limit} lamang ang nababasa; pumili ng uri ng pangyayari o saklaw ng petsa para makita ang mas luma.",
  },
  "city.access.notRecorded.title": {
    en: "The access log can't be shown right now",
    tl: "Hindi maipakita ang talaan ng access ngayon",
  },
  "city.access.notRecorded.body": {
    en: "Every opening of this page is recorded, and that record couldn't be written, so nothing is shown. Try again in a moment.",
    tl: "Itinatala ang bawat pagbukas ng pahinang ito, at hindi naisulat ang talang iyon, kaya walang ipinapakita. Subukang muli maya-maya.",
  },
  "city.access.notRecorded.session": {
    en: "Your session has expired, so this opening couldn't be recorded and nothing is shown. Sign in again to see the access log.",
    tl: "Nag-expire na ang iyong session, kaya hindi naitala ang pagbukas na ito at walang ipinapakita. Mag-sign in muli para makita ang talaan ng access.",
  },
  "city.access.retry": { en: "Try again", tl: "Subukang muli" },
  "banner.what.cityMap": { en: "The city map", tl: "mapa ng lungsod" },
  "city.map.title": { en: "Open reports on the map", tl: "Mga bukas na ulat sa mapa" },
  "city.map.intro": {
    en: "Reports still open (awaiting review, validated, or with agencies), filed in the last {days} days. Each dot is where the reporter's phone was when they filed. A report whose resident withheld their identity, or asked for discreet reporting, is never placed on the map; it is counted under its barangay instead.",
    tl: "Mga ulat na bukas pa (naghihintay ng pagsusuri, na-validate, o nasa ahensya), na naisampa sa nakaraang {days} araw. Ang bawat tuldok ay kung saan naroon ang telepono ng nag-ulat nang magsampa. Ang ulat na itinago ng residente ang pagkakakilanlan, o humiling ng discreet na pag-uulat, ay hindi kailanman inilalagay sa mapa; binibilang ito sa barangay nito.",
  },
  "city.map.label": { en: "Map of open reports in Lipa City", tl: "Mapa ng mga bukas na ulat sa Lungsod ng Lipa" },
  "city.map.loading": { en: "Loading the map…", tl: "Nilo-load ang mapa…" },
  "city.map.failed": {
    en: "The map couldn't load. The counts and the list below still cover every open report.",
    tl: "Hindi na-load ang mapa. Saklaw pa rin ng mga bilang at listahan sa ibaba ang bawat bukas na ulat.",
  },
  "city.map.legend": { en: "Priority", tl: "Priyoridad" },
  "city.map.filteredNote": {
    en: "Showing {shown} of {total} reports on the map. The counts cover every open report.",
    tl: "Ipinapakita ang {shown} sa {total} ulat sa mapa. Saklaw ng mga bilang ang bawat bukas na ulat.",
  },
  "city.map.openHint": { en: "Click to open its details", tl: "I-click para buksan ang detalye" },
  "city.map.byBarangay": { en: "By barangay", tl: "Bawat barangay" },
  "city.map.col.mapped": { en: "On the map", tl: "Nasa mapa" },
  "city.map.col.withheld": { en: "Identity withheld", tl: "Itinago ang pagkakakilanlan" },
  "city.map.col.unlocated": { en: "No location", tl: "Walang lokasyon" },
  "city.map.countsCaption": {
    en: "Open reports per barangay: on the map, with the identity withheld, discreet, and sent without a location",
    tl: "Mga bukas na ulat bawat barangay: nasa mapa, itinago ang pagkakakilanlan, discreet, at naipadala nang walang lokasyon",
  },
  "city.map.total": { en: "All barangays", tl: "Lahat ng barangay" },
  "city.map.listTitle": { en: "Reports on the map", tl: "Mga ulat sa mapa" },
  "city.map.listCaption": { en: "Open reports placed on the map", tl: "Mga bukas na ulat na nasa mapa" },
  "city.map.empty": {
    en: "No report filed in the last {days} days is still open.",
    tl: "Walang bukas pang ulat na naisampa sa nakaraang {days} araw.",
  },
  "city.map.noneMapped": {
    en: "None of the open reports can be placed on the map: each has the identity withheld, is discreet, or was sent without a location.",
    tl: "Wala sa mga bukas na ulat ang mailalagay sa mapa: bawat isa ay itinago ang pagkakakilanlan, discreet, o naipadala nang walang lokasyon.",
  },
  "city.map.footer": {
    en: "Data as of {time}. A dot marks where the reporter's phone was, which may not be the exact spot of the incident. The street map comes from OpenStreetMap.",
    tl: "Datos hanggang {time}. Ang tuldok ay kung saan naroon ang telepono ng nag-ulat, na maaaring hindi eksaktong lugar ng insidente. Galing sa OpenStreetMap ang mapa ng kalye.",
  },
  "city.map.capped": {
    en: "More reports are open than this page reads: it takes the newest {limit} that may be placed on the map and the newest {limit} that may not.",
    tl: "Mas marami ang bukas na ulat kaysa nababasa ng pahinang ito: kinukuha nito ang pinakabagong {limit} na maaaring ilagay sa mapa at ang pinakabagong {limit} na hindi.",
  },
  "banner.what.cityAgencies": { en: "The agency list", tl: "listahan ng ahensya" },
  "city.agencies.title": { en: "Responder agencies", tl: "Mga ahensyang tumutugon" },
  "city.agencies.intro": {
    en: "Every agency configured in the system, and the report categories routing sends to each.",
    tl: "Bawat ahensyang naka-configure sa sistema, at ang mga kategorya ng ulat na ipinapasa sa bawat isa.",
  },
  "city.agencies.caption": { en: "Agencies and the categories routed to them", tl: "Mga ahensya at ang mga kategoryang ipinapasa sa kanila" },
  "city.agencies.col.agency": { en: "Agency", tl: "Ahensya" },
  "city.agencies.col.code": { en: "Code", tl: "Code" },
  "city.agencies.col.tier": { en: "Tier", tl: "Tier" },
  "city.agencies.col.categories": { en: "Receives", tl: "Tumatanggap ng" },
  "city.agencies.lead": { en: "lead", tl: "pangunahin" },
  "city.agencies.none": { en: "No category routes here", tl: "Walang kategoryang ipinapasa rito" },
  "city.agencies.mappingUnavailable": {
    en: "Couldn't load the routing rules",
    tl: "Hindi ma-load ang mga tuntunin sa pagpasa",
  },
  "city.agencies.empty": { en: "No agency is configured.", tl: "Walang naka-configure na ahensya." },
  "city.agencies.footer": {
    en: "Read from the routing table the console uses when a barangay routes a report. Adding agencies or changing where a category goes isn't done from this page.",
    tl: "Mula sa talaan ng pagpasa na ginagamit ng console kapag nagpapasa ang barangay ng ulat. Hindi rito ginagawa ang pagdagdag ng ahensya o ang pagbago kung saan napupunta ang isang kategorya.",
  },
  "banner.what.cityReports": { en: "The city's reports", tl: "mga ulat ng lungsod" },
  "city.reports.title": { en: "Reports across the city", tl: "Mga ulat sa buong lungsod" },
  "city.reports.intro": {
    en: "Every report filed in the last {days} days, newest first. Opening one is recorded in the access log.",
    tl: "Bawat ulat na naisampa sa nakaraang {days} araw, pinakabago muna. Itinatala sa talaan ng access ang bawat pagbukas.",
  },
  "city.filter.allBarangays": { en: "All barangays", tl: "Lahat ng barangay" },
  "city.filter.stage": { en: "Stage", tl: "Yugto" },
  "city.stage.all": { en: "All", tl: "Lahat" },
  "city.stage.awaiting": { en: "Awaiting review", tl: "Naghihintay ng pagsusuri" },
  "city.stage.validated": { en: "Validated, not routed", tl: "Na-validate, hindi pa naipasa" },
  "city.stage.withAgencies": { en: "With agencies", tl: "Nasa ahensya" },
  "city.stage.rejected": { en: "Rejected", tl: "Tinanggihan" },
  "city.reports.caption": { en: "Reports filed across the city", tl: "Mga ulat na naisampa sa buong lungsod" },
  "city.reports.col.submitted": { en: "Submitted", tl: "Naisumite" },
  "city.reports.col.agencies": { en: "Agencies", tl: "Mga ahensya" },
  "city.reports.col.open": { en: "Open", tl: "Buksan" },
  "city.reports.open": { en: "Details", tl: "Detalye" },
  "city.reports.agenciesUnavailable": { en: "Couldn't load", tl: "Hindi ma-load" },
  "city.reports.openMissing": {
    en: "The report you opened isn't in this list, which covers the last {days} days, newest {limit} first.",
    tl: "Wala sa listahang ito ang ulat na binuksan mo; saklaw nito ang nakaraang {days} araw, ang pinakabagong {limit}.",
  },
  "city.reports.empty": {
    en: "No reports were filed in the last {days} days.",
    tl: "Walang ulat na naisampa sa nakaraang {days} araw.",
  },
  "city.reports.emptyFiltered": {
    en: "No report in the last {days} days matches these filters.",
    tl: "Walang ulat sa nakaraang {days} araw na tugma sa mga filter na ito.",
  },
  "city.reports.footer": {
    en: "{count} shown, newest first. The list shows no description and names no reporter; the drawer shows the resident's account, and opening it is logged.",
    tl: "{count} ang ipinapakita, pinakabago muna. Walang paglalarawan at walang pangalan ng nag-ulat sa listahan; nasa drawer ang salaysay ng residente, at itinatala ang pagbukas nito.",
  },
  "city.reports.capped": {
    en: "Only the newest {limit} are listed; narrow the filters to see older ones.",
    tl: "Ang pinakabagong {limit} lamang ang nakalista; paliitin ang mga filter para makita ang mas luma.",
  },
  "city.drawer.reviewed": { en: "Reviewed", tl: "Nasuri" },
  "city.drawer.readOnly": {
    en: "Read-only. Decisions and routing stay with the barangay.",
    tl: "Pagtingin lamang. Nasa barangay ang pagpapasya at pagpasa.",
  },
  "city.drawer.notRouted": { en: "Not routed to any agency.", tl: "Hindi pa naipasa sa anumang ahensya." },
  "city.drawer.resolvedAtBarangay": {
    en: "Resolved at the barangay. It was not sent to any agency.",
    tl: "Nalutas sa barangay. Hindi ito ipinasa sa anumang ahensya.",
  },
  "city.drawer.agenciesUnavailable": {
    en: "Couldn't load the agencies for this report.",
    tl: "Hindi ma-load ang mga ahensya para sa ulat na ito.",
  },
  "banner.what.cityOverview": { en: "The city overview", tl: "pangkalahatang-tanaw ng lungsod" },
  "banner.what.cityResponse": { en: "Agency response times", tl: "oras ng tugon ng ahensya" },
  "city.readOnly": {
    en: "Read-only. Decisions and routing stay with each barangay. No reporter is named on these pages.",
    tl: "Pagtingin lamang. Nasa bawat barangay pa rin ang pagpapasya at pag-route. Walang nag-ulat na pinangangalanan sa mga pahinang ito.",
  },
  "city.overview.title": { en: "City-wide activity", tl: "Aktibidad sa buong lungsod" },
  "city.overview.intro": {
    en: "Reports from every barangay over the last 7 days, and what is waiting for a decision right now.",
    tl: "Mga ulat mula sa bawat barangay sa nakaraang 7 araw, at ang naghihintay ng pasya ngayon.",
  },
  "city.tile.today": { en: "Reports today", tl: "Mga ulat ngayong araw" },
  "city.tile.average": { en: "Daily average, 7 days", tl: "Karaniwan bawat araw, 7 araw" },
  "city.tile.awaiting": { en: "Awaiting review", tl: "Naghihintay ng pagsusuri" },
  "city.tile.critical": { en: "Critical awaiting review", tl: "Critical na naghihintay" },
  "city.tile.pastSla": { en: "Emergencies past {minutes} min", tl: "Emergency na lampas {minutes} min" },
  "city.col.barangay": { en: "Barangay", tl: "Barangay" },
  "city.col.daily": { en: "Last 7 days, by day", tl: "Nakaraang 7 araw, bawat araw" },
  "city.col.week": { en: "7 days", tl: "7 araw" },
  "city.col.today": { en: "Today", tl: "Ngayon" },
  "city.col.awaiting": { en: "Awaiting review now", tl: "Naghihintay ngayon" },
  "city.col.validated": { en: "Validated (7 days)", tl: "Na-validate (7 araw)" },
  "city.col.rejected": { en: "Rejected (7 days)", tl: "Tinanggihan (7 araw)" },
  "city.overview.caption": {
    en: "Reports per barangay over the last 7 days",
    tl: "Mga ulat bawat barangay sa nakaraang 7 araw",
  },
  "city.dayCount": { en: "{day}: {count}", tl: "{day}: {count}" },
  "city.unnamedBarangay": { en: "Barangay name unavailable", tl: "Hindi makuha ang pangalan ng barangay" },
  "city.noBarangay": { en: "No barangay recorded", tl: "Walang nakatalang barangay" },
  "city.overview.empty": {
    en: "No reports were filed in any barangay in the last 7 days, and none is waiting for a decision.",
    tl: "Walang ulat na naisampa sa alinmang barangay sa nakaraang 7 araw, at walang naghihintay ng pasya.",
  },
  "city.overview.footer": {
    en:
      "Counted at {time}. Validated and rejected count the last 7 days' reports by where each stands now; " +
      "awaiting review counts every undecided report, however old. A barangay with no reports in that time isn't listed.",
    tl:
      "Binilang noong {time}. Ang na-validate at tinanggihan ay bilang ng mga ulat sa nakaraang 7 araw ayon sa kalagayan nila ngayon; " +
      "ang naghihintay ay bilang ng lahat ng hindi pa napagpapasyahan, gaano man katagal. Hindi nakalista ang barangay na walang ulat sa panahong iyon.",
  },
  "city.capped": {
    en: "Only the first {limit} reports were counted.",
    tl: "Ang unang {limit} na ulat lamang ang binilang.",
  },
  "city.response.title": { en: "Agency response times", tl: "Oras ng tugon ng ahensya" },
  "city.response.intro": {
    en:
      "Every routing in the last {days} days, per agency: how long until the agency acknowledged it, " +
      "and how long from acknowledgement to resolution.",
    tl:
      "Bawat pag-route sa nakaraang {days} araw, bawat ahensya: gaano katagal bago ito kinilala ng ahensya, " +
      "at gaano katagal mula sa pagkilala hanggang sa paglutas.",
  },
  "city.response.caption": { en: "Response times per agency", tl: "Oras ng tugon bawat ahensya" },
  "city.response.col.agency": { en: "Agency", tl: "Ahensya" },
  "city.response.col.routed": { en: "Routed", tl: "Na-route" },
  "city.response.col.awaiting": { en: "Awaiting acknowledgement", tl: "Naghihintay ng pagkilala" },
  "city.response.col.toAck": { en: "Time to acknowledge", tl: "Oras bago kilalanin" },
  "city.response.col.toResolve": { en: "Acknowledged to resolved", tl: "Mula pagkilala hanggang lutas" },
  "city.response.col.resolved": { en: "Resolved", tl: "Nalutas" },
  "city.response.col.returned": { en: "Returned out of scope", tl: "Ibinalik, labas sa saklaw" },
  "city.response.median": { en: "median {value}", tl: "median {value}" },
  "city.response.p95": { en: "95th {value}", tl: "ika-95 {value}" },
  "city.response.samples": { en: "{count} timed", tl: "{count} naorasan" },
  "city.response.noTiming": { en: "No timing yet", tl: "Wala pang oras" },
  "city.response.grid.ack": {
    en: "Time to acknowledge, by agency and category",
    tl: "Oras bago kilalanin, bawat ahensya at kategorya",
  },
  "city.response.grid.resolve": {
    en: "Acknowledged to resolved, by agency and category",
    tl: "Mula pagkilala hanggang lutas, bawat ahensya at kategorya",
  },
  "city.response.exported": {
    en: "Exported the agency response times as CSV",
    tl: "Na-export ang oras ng tugon ng ahensya bilang CSV",
  },
  "city.response.exportNothing": { en: "Nothing to export", tl: "Walang mai-e-export" },
  "city.unnamedAgency": { en: "Agency name unavailable", tl: "Hindi makuha ang pangalan ng ahensya" },
  "city.response.empty": {
    en: "No report was routed to an agency in the last {days} days.",
    tl: "Walang ulat na na-route sa ahensya sa nakaraang {days} araw.",
  },
  "city.response.footer": {
    en:
      "Automatic routing is off, so each clock starts when a barangay routed the report. " +
      "Reports returned out of scope are counted apart and kept out of the resolution time. " +
      "The 95th percentile appears once an agency has {min} timings.",
    tl:
      "Naka-off ang awtomatikong pag-route, kaya nagsisimula ang bawat orasan nang i-route ng barangay ang ulat. " +
      "Hiwalay na binibilang ang mga ibinalik bilang labas sa saklaw at hindi isinasama sa oras ng paglutas. " +
      "Lumalabas ang ika-95 na percentile kapag may {min} nang naorasan ang ahensya.",
  },

  // --- How a write ended, shared by the admin pages -------------------------
  // The actions behind Verify Resident answer with a code; these word it.
  "common.required": { en: "required", tl: "kailangan" },
  "outcome.invalid": {
    en: "That request wasn't valid. Refresh the page and try again.",
    tl: "Hindi wasto ang kahilingang iyon. I-refresh ang page at subukang muli.",
  },
  "outcome.sessionExpired": {
    en: "Your session expired. Sign in again.",
    tl: "Nag-expire ang iyong session. Mag-sign in muli.",
  },
  "outcome.unreachable": {
    en: "Couldn't reach the server. Check your connection, then try again.",
    tl: "Hindi maabot ang server. Tingnan ang iyong koneksyon, saka subukang muli.",
  },
  "outcome.failed": { en: "Something went wrong. Try again.", tl: "May nangyaring mali. Subukang muli." },
  "outcome.noAnswer": {
    en: "Couldn't confirm that went through. Refresh the page and check before trying again.",
    tl: "Hindi makumpirma kung natuloy iyon. I-refresh ang page at tingnan muna bago subukang muli.",
  },

  // --- Verify Resident (barangay admins) ------------------------------------
  "nav.residents": { en: "Residents", tl: "Mga Residente" },
  "nav.verifyResident": { en: "Verify Resident", tl: "I-verify ang Residente" },
  "banner.what.residents": { en: "The resident list", tl: "listahan ng residente" },
  "queue.shortcuts.title": { en: "Shortcuts", tl: "Mga shortcut" },
  "queue.shortcuts.revoke": { en: "Revoke Attestation", tl: "Bawiin ang Patotoo" },
  "verify.intro": {
    en:
      "Tier 1 verification is the barangay's attestation that a resident lives here, under RA 7160 Section 389(b). " +
      "Only the attestation is recorded: who attested, how, and when. No ID number, ID image or biometric is stored (RA 10173 Section 11(c)).",
    tl:
      "Ang Tier 1 na beripikasyon ay patotoo ng barangay na dito nakatira ang residente, alinsunod sa RA 7160 Seksyon 389(b). " +
      "Ang patotoo lamang ang itinatala: sino ang nagpatotoo, paano, at kailan. Walang iniimbak na ID number, larawan ng ID o biometric (RA 10173 Seksyon 11(c)).",
  },
  "verify.scope": {
    en: "Residents of Brgy. {barangay} only. The database refuses a resident of another barangay.",
    tl: "Mga residente ng Brgy. {barangay} lamang. Tinatanggihan ng database ang residente ng ibang barangay.",
  },
  "verify.search.label": {
    en: "Search residents by name, by a full phone number, or by a number's last 4 digits",
    tl: "Hanapin ang residente ayon sa pangalan, buong numero ng telepono, o huling 4 na digit ng numero",
  },
  "verify.search.placeholder": { en: "Name, full number, or last 4 digits", tl: "Pangalan, buong numero, o huling 4 na digit" },
  "verify.search.submit": { en: "Search", tl: "Hanapin" },
  "verify.search.clear": { en: "Clear search", tl: "Alisin ang paghahanap" },
  "verify.search.result": { en: "Residents matching [{query}]: {count}.", tl: "Mga residenteng tumutugma sa [{query}]: {count}." },
  "verify.search.refused": {
    en: "Not permitted. Only a barangay admin can search residents.",
    tl: "Hindi pinapayagan. Admin ng barangay lamang ang makakapaghanap ng residente.",
  },
  "verify.search.noAnswer": {
    en: "The search got no answer. Check your connection, then try again.",
    tl: "Walang sagot sa paghahanap. Tingnan ang iyong koneksyon, saka subukang muli.",
  },
  "verify.filter.label": { en: "Residents to show", tl: "Mga residenteng ipapakita" },
  "verify.filter.tier0": { en: "Not yet verified", tl: "Hindi pa beripikado" },
  "verify.filter.tier1": { en: "Verified", tl: "Beripikado na" },
  "verify.filter.all": { en: "All residents", tl: "Lahat ng residente" },
  "verify.caption": {
    en: "Residents of the barangay and their verification tier",
    tl: "Mga residente ng barangay at ang kanilang tier ng beripikasyon",
  },
  "verify.col.resident": { en: "Resident", tl: "Residente" },
  "verify.col.tier": { en: "Tier", tl: "Tier" },
  "verify.col.verification": { en: "Verification", tl: "Beripikasyon" },
  "verify.col.action": { en: "Action", tl: "Aksyon" },
  "verify.unnamed": { en: "Name not set", tl: "Walang nakatalang pangalan" },
  // Who a sentence is about. A profile can carry no name, and then the
  // account is told apart by its phone number's ending. Tagalog needs the
  // marker with it (si/ang, and ni/ng for [of]), so the phrase carries it.
  "verify.who.name": { en: "{name}", tl: "si {name}" },
  "verify.who.nameOf": { en: "{name}", tl: "ni {name}" },
  "verify.who.phone": {
    en: "the holder of the account with a phone ending in {digits}",
    tl: "ang may-ari ng account na may teleponong nagtatapos sa {digits}",
  },
  "verify.who.phoneOf": {
    en: "the holder of the account with a phone ending in {digits}",
    tl: "ng may-ari ng account na may teleponong nagtatapos sa {digits}",
  },
  "verify.who.account": { en: "the holder of this account", tl: "ang may-ari ng account na ito" },
  "verify.who.accountOf": { en: "the holder of this account", tl: "ng may-ari ng account na ito" },
  "verify.phoneEnding": { en: "Phone ending in {digits}", tl: "Teleponong nagtatapos sa {digits}" },
  "verify.registered": { en: "Registered {date}", tl: "Nagrehistro noong {date}" },
  "verify.tier.tier0": { en: "Tier 0 · phone-verified", tl: "Tier 0 · beripikado ang telepono" },
  "verify.tier.tier1": { en: "Tier 1 · barangay-verified", tl: "Tier 1 · pinatotohanan ng barangay" },
  "verify.method.in_person": { en: "In person", tl: "Personal" },
  "verify.method.field": { en: "Field visit", tl: "Pagbisita sa tahanan" },
  "verify.method.bulk_import": { en: "Barangay records", tl: "Rekord ng barangay" },
  "verify.verifiedBy": { en: "By {who}", tl: "Ni {who}" },
  "verify.notVerified": { en: "Not verified", tl: "Hindi pa beripikado" },
  "verify.detailsUnavailable": {
    en: "Verification details couldn't load, so only each resident's tier is shown. Refresh to try again.",
    tl: "Hindi na-load ang detalye ng beripikasyon, kaya tier lamang ng bawat residente ang ipinapakita. I-refresh para subukang muli.",
  },
  "verify.lastRevoked": { en: "An earlier verification was revoked on {date}.", tl: "May naunang beripikasyong binawi noong {date}." },
  "verify.lastRevokedReason": {
    en: "An earlier verification was revoked on {date}: {reason}",
    tl: "May naunang beripikasyong binawi noong {date}: {reason}",
  },
  "verify.action.verify": { en: "Verify", tl: "I-verify" },
  "verify.action.verifyLabel": { en: "Verify {who}", tl: "I-verify {who}" },
  "verify.action.revoke": { en: "Revoke", tl: "Bawiin" },
  "verify.action.revokeLabel": { en: "Revoke the verification of {whoOf}", tl: "Bawiin ang beripikasyon {whoOf}" },
  "verify.seniorOnly": {
    en: "Only a senior barangay admin can revoke.",
    tl: "Senior admin ng barangay lamang ang makakabawi.",
  },
  "verify.empty.title": { en: "No residents to show", tl: "Walang residenteng maipapakita" },
  "verify.empty.tier0": {
    en: "No resident of this barangay is waiting for verification: each one with an account is verified already, or none has registered yet.",
    tl: "Walang residente ng barangay na ito ang naghihintay ng beripikasyon: beripikado na ang bawat may account, o wala pang nagrerehistro.",
  },
  "verify.empty.tier1": {
    en: "No resident of this barangay has been verified yet.",
    tl: "Wala pang residente ng barangay na ito ang na-verify.",
  },
  "verify.empty.all": {
    en: "No resident of this barangay has an account yet.",
    tl: "Wala pang residente ng barangay na ito ang may account.",
  },
  "verify.empty.search": {
    en: "No resident matches [{query}] here. Check the spelling or the number, or look under another group above.",
    tl: "Walang residenteng tumutugma sa [{query}] dito. Tingnan ang baybay o ang numero, o tumingin sa ibang grupo sa itaas.",
  },
  "verify.footerOne": { en: "1 resident shown.", tl: "1 residente ang ipinapakita." },
  "verify.footer": { en: "{count} residents shown, by name.", tl: "{count} residente ang ipinapakita, ayon sa pangalan." },
  "verify.footerCapped": {
    en: "Showing the first {limit} residents by name. Search by name or phone number to find one not listed.",
    tl: "Ipinapakita ang unang {limit} residente ayon sa pangalan. Maghanap ayon sa pangalan o numero ng telepono para makita ang wala sa listahan.",
  },
  "verify.attest.title": { en: "Verify {who} as a resident", tl: "I-verify {who} bilang residente" },
  "verify.attest.description": {
    en: "This moves the account from Tier 0 to Tier 1. A senior barangay admin can revoke it later.",
    tl: "Ililipat nito ang account mula Tier 0 patungong Tier 1. Maaari itong bawiin ng senior admin ng barangay.",
  },
  "verify.attest.method": { en: "How residency was established", tl: "Paraan ng patotoo" },
  "verify.attest.hint.in_person": { en: "The resident is with you now.", tl: "Kasama mo ang residente ngayon." },
  "verify.attest.hint.field": { en: "You visited the resident at home.", tl: "Binisita mo ang residente sa kanyang tahanan." },
  "verify.attest.hint.bulk_import": {
    en: "From the barangay's own list of long-time residents.",
    tl: "Mula sa sariling listahan ng barangay ng matagal nang residente.",
  },
  "verify.attest.oath": {
    en: "I attest that {who} is a resident of Brgy. {barangay}, under RA 7160 Section 389(b). A false attestation can be sanctioned.",
    tl: "Pinatutotohanan ko na {who} ay residente ng Brgy. {barangay}, alinsunod sa RA 7160 Seksyon 389(b). May parusa ang maling patotoo.",
  },
  "verify.attest.minimization": {
    en: "Nothing of the ID or proof shown to you is stored: no ID number, no image, no biometric. Only this attestation is recorded (RA 10173 Section 11(c)).",
    tl: "Walang iniimbak mula sa ID o patunay na ipinakita sa iyo: walang ID number, larawan o biometric. Ang patotoong ito lamang ang itinatala (RA 10173 Seksyon 11(c)).",
  },
  "verify.attest.confirm": { en: "Verify resident", tl: "I-verify ang residente" },
  "verify.revoke.title": { en: "Revoke the verification of {whoOf}", tl: "Bawiin ang beripikasyon {whoOf}" },
  "verify.revoke.description": {
    en: "This returns the account to Tier 0. The reason is recorded with the revocation.",
    tl: "Ibabalik nito ang account sa Tier 0. Itatala ang dahilan kasama ng pagbawi.",
  },
  "verify.revoke.placeholder": {
    en: "For example: moved out of the barangay",
    tl: "Halimbawa: lumipat na sa labas ng barangay",
  },
  "verify.revoke.confirm": { en: "Revoke verification", tl: "Bawiin ang beripikasyon" },
  "verify.toast.attested": { en: "{who} is now Tier 1.", tl: "Tier 1 na {who}." },
  "verify.toast.revoked": { en: "{who} is back to Tier 0.", tl: "Ibinalik {who} sa Tier 0." },
  "verify.toast.staleAttest": {
    en: "{who} was already verified. The list is up to date now.",
    tl: "Beripikado na pala {who}. Napapanahon na ang listahan.",
  },
  "verify.toast.staleRevoke": {
    en: "{who} has no active verification to revoke. The list is up to date now.",
    tl: "Walang aktibong beripikasyon {who} na mababawi. Napapanahon na ang listahan.",
  },
  "verify.toast.refusedAttest": {
    en: "Not permitted. Your role can't verify residents, or this resident isn't in your barangay.",
    tl: "Hindi pinapayagan. Hindi makakapag-verify ng residente ang iyong tungkulin, o wala sa iyong barangay ang residenteng ito.",
  },
  "verify.toast.refusedRevoke": {
    en: "Not permitted. Only a senior barangay admin can revoke, and only in their own barangay.",
    tl: "Hindi pinapayagan. Senior admin ng barangay lamang ang makakabawi, at sa sarili lamang niyang barangay.",
  },
  "verify.toast.notEligible": {
    en: "This account can't be verified: it isn't a resident's account.",
    tl: "Hindi ma-verify ang account na ito: hindi ito account ng residente.",
  },

  // --- Sanctions (barangay admins) ------------------------------------------
  "nav.sanctions": { en: "Sanctions", tl: "Mga Parusa" },
  "banner.what.sanctions": { en: "The sanctions list", tl: "listahan ng parusa" },
  "queue.kpi.sanctions": { en: "Sanctions to lift", tl: "Parusang maaaring alisin" },
  "queue.kpi.sanctionsMalicious": { en: "Malicious-track sanctions", tl: "Parusa sa malicious track" },
  "sanctions.intro": {
    en:
      "Active cooldowns and suspensions on residents of this barangay. They are applied automatically when an agency closes a resident's report as confirmed false. " +
      "A resident whose appeal you accept can have theirs lifted here.",
    tl:
      "Mga aktibong cooldown at suspensiyon ng mga residente ng barangay na ito. Awtomatiko itong ipinapataw kapag isinara ng ahensya ang ulat ng residente bilang hindi totoo. " +
      "Maaaring alisin dito ang parusa ng residenteng tinanggap mo ang apela.",
  },
  "sanctions.gate": {
    en: "Inaccurate track: any barangay admin can lift. Malicious track: a senior barangay admin only.",
    tl: "Inaccurate track: maaaring alisin ng sinumang admin ng barangay. Malicious track: senior admin ng barangay lamang.",
  },
  "sanctions.privacy": {
    en: "The report behind a strike is not shown here, and a strike or a cooldown is dated by its day only, to keep a sanction from pointing at who filed a report.",
    tl: "Hindi ipinapakita rito ang ulat na pinagmulan ng strike, at araw lamang ang petsa ng strike o cooldown, upang hindi maituro ng parusa kung sino ang nag-ulat.",
  },
  "sanctions.filter.label": { en: "Track to show", tl: "Track na ipapakita" },
  "sanctions.filter.all": { en: "All", tl: "Lahat" },
  "sanctions.track.inaccurate": { en: "Inaccurate track", tl: "Inaccurate track" },
  "sanctions.track.malicious": { en: "Malicious track", tl: "Malicious track" },
  "sanctions.kind.cooldown": { en: "Cooldown", tl: "Cooldown" },
  "sanctions.kind.suspension": { en: "Suspension", tl: "Suspensiyon" },
  "sanctions.endsOn": { en: "Ends {date}", tl: "Matatapos sa {date}" },
  "sanctions.untilLifted": { en: "Until lifted", tl: "Hanggang alisin" },
  "sanctions.suspendedOn": { en: "suspended {date}", tl: "sinuspinde noong {date}" },
  "sanctions.cooldownAlso": { en: "Also in a cooldown ({track}), ending {date}.", tl: "May cooldown din ({track}), matatapos sa {date}." },
  "sanctions.strikes": {
    en: "Strikes: inaccurate {inaccurate}, malicious {malicious}",
    tl: "Mga strike: inaccurate {inaccurate}, malicious {malicious}",
  },
  "sanctions.trustScore": { en: "Trust score {score}", tl: "Trust score {score}" },
  "sanctions.action.lift": { en: "Lift", tl: "Alisin" },
  "sanctions.action.liftLabel": { en: "Lift the sanction of {whoOf}", tl: "Alisin ang parusa {whoOf}" },
  "sanctions.seniorOnly": {
    en: "On the malicious track: only a senior barangay admin can lift this.",
    tl: "Nasa malicious track: senior admin ng barangay lamang ang makakaalis nito.",
  },
  "sanctions.history.summary": { en: "Strikes and lifts ({count})", tl: "Mga strike at pag-alis ({count})" },
  "sanctions.history.empty": { en: "No strike or lift on record.", tl: "Walang nakatalang strike o pag-alis." },
  "sanctions.history.unavailable": {
    en: "The history couldn't load. Refresh to try again.",
    tl: "Hindi na-load ang kasaysayan. I-refresh para subukang muli.",
  },
  "sanctions.history.score": { en: "Trust score {before} to {after}", tl: "Trust score mula {before} naging {after}" },
  "sanctions.history.strikes": {
    en: "strikes then: inaccurate {inaccurate}, malicious {malicious}",
    tl: "mga strike noon: inaccurate {inaccurate}, malicious {malicious}",
  },
  "sanctions.history.reason": { en: "Reason for the lift: {reason}", tl: "Dahilan ng pag-alis: {reason}" },
  "sanctions.cause.inaccurate": { en: "Inaccurate report", tl: "Hindi tumpak na ulat" },
  "sanctions.cause.malicious": { en: "Malicious report", tl: "Malisyosong ulat" },
  "sanctions.cause.sanction_lifted": { en: "Sanction lifted", tl: "Inalis ang parusa" },
  "sanctions.applied.none": { en: "no sanction", tl: "walang parusa" },
  "sanctions.applied.cooldown": { en: "cooldown", tl: "cooldown" },
  "sanctions.applied.suspension": { en: "suspension", tl: "suspensiyon" },
  "sanctions.applied.lifted": { en: "lifted", tl: "inalis" },
  "sanctions.empty.title": { en: "No active sanctions", tl: "Walang aktibong parusa" },
  "sanctions.empty.body": {
    en: "No resident of this barangay is in a cooldown or suspended right now.",
    tl: "Walang residente ng barangay na ito ang nasa cooldown o suspendido ngayon.",
  },
  "sanctions.empty.filtered": {
    en: "No active sanction on this track right now.",
    tl: "Walang aktibong parusa sa track na ito ngayon.",
  },
  "sanctions.footerOne": { en: "1 sanctioned resident shown.", tl: "1 residenteng may parusa ang ipinapakita." },
  "sanctions.footer": { en: "{count} sanctioned residents shown.", tl: "{count} residenteng may parusa ang ipinapakita." },
  "sanctions.footerCapped": {
    en: "Showing the first {limit} sanctioned residents, suspensions first.",
    tl: "Ipinapakita ang unang {limit} residenteng may parusa, una ang mga suspensiyon.",
  },
  "sanctions.lift.title": { en: "Lift the sanction of {whoOf}", tl: "Alisin ang parusa {whoOf}" },
  "sanctions.lift.description": {
    en: "For a resident whose appeal you have heard and accepted. The reason is recorded with the lift.",
    tl: "Para sa residenteng napakinggan at tinanggap mo ang apela. Itatala ang dahilan kasama ng pag-alis.",
  },
  "sanctions.lift.effects": { en: "What lifting does", tl: "Ang ginagawa ng pag-alis" },
  "sanctions.lift.effect.score": {
    en: "The trust score returns to 0.5, the neutral starting value.",
    tl: "Babalik sa 0.5 ang trust score, ang neutral na panimulang halaga.",
  },
  "sanctions.lift.effect.ends": {
    en: "The cooldown and any suspension end now.",
    tl: "Matatapos na ngayon ang cooldown at anumang suspensiyon.",
  },
  "sanctions.lift.effect.strikesSuspension": {
    en: "Lifting a suspension resets the strike count. The malicious count resets only when a senior barangay admin lifts.",
    tl: "Ibinabalik sa zero ng pag-alis ng suspensiyon ang bilang ng strike. Ibinabalik lamang ang bilang sa malicious kapag senior admin ng barangay ang nag-alis.",
  },
  "sanctions.lift.effect.strikesCooldown": {
    en: "The strike counts stay as they are: only lifting a suspension resets them.",
    tl: "Mananatili ang bilang ng mga strike: pag-alis lamang ng suspensiyon ang nagbabalik nito sa zero.",
  },
  "sanctions.lift.effect.tier": {
    en: "The resident's verification tier does not change.",
    tl: "Hindi magbabago ang tier ng beripikasyon ng residente.",
  },
  "sanctions.lift.effect.recorded": {
    en: "The lift is recorded with your reason.",
    tl: "Itatala ang pag-alis kasama ng iyong dahilan.",
  },
  "sanctions.lift.actor": { en: "You are lifting as {name}, {role}.", tl: "Ikaw ang nag-aalis bilang {name}, {role}." },
  "sanctions.lift.placeholder": {
    en: "The appeal, what supports it, and your decision",
    tl: "Ang apela, ang sumusuporta rito, at ang iyong pasya",
  },
  "sanctions.lift.confirm": { en: "Confirm lift", tl: "Kumpirmahin ang pag-alis" },
  "sanctions.toast.lifted": {
    en: "{who} is no longer sanctioned. The trust score is back to 0.5.",
    tl: "Wala nang parusa {who}. Bumalik sa 0.5 ang trust score.",
  },
  "sanctions.toast.stale": {
    en: "{who} has no active sanction any more. The list is up to date now.",
    tl: "Wala nang aktibong parusa {who}. Napapanahon na ang listahan.",
  },
  "sanctions.toast.refused": {
    en: "Not permitted. A lift needs a barangay admin of the resident's own barangay, and a senior barangay admin for anything on the malicious track.",
    tl: "Hindi pinapayagan. Admin ng barangay ng residente ang kailangan sa pag-alis, at senior admin ng barangay para sa anumang nasa malicious track.",
  },

  // --- City account: two-step sign-in (Settings) ----------------------------
  // The two-step page itself is English, like the sign-in page it continues.
  "profile.twoStep": { en: "Two-step sign-in", tl: "Dalawang-hakbang na pag-sign in" },
  "profile.twoStepSince": {
    en: "On: authenticator app, set up {date}",
    tl: "Naka-on: authenticator app, na-set up noong {date}",
  },
  "profile.twoStepOn": { en: "On: authenticator app", tl: "Naka-on: authenticator app" },
  "profile.twoStepNote": {
    en: "Each sign-in asks for a code from the app. To move it to another phone, ask the system's administrator.",
    tl: "Hinihingi ang code mula sa app sa bawat pag-sign in. Para ilipat ito sa ibang telepono, magtanong sa administrator ng sistema.",
  },

  // --- Recorded exports ------------------------------------------------------
  // {nothing} is one of the two export.nothing.* phrases.
  "export.recordedNote": {
    en: "Exports and prints made with the buttons on this page are recorded in the access trail first.",
    tl: "Itinatala muna sa talaan ng access ang mga export at print na ginawa gamit ang mga button sa page na ito.",
  },
  "export.nothing.file": { en: "nothing was downloaded", tl: "walang na-download" },
  "export.nothing.print": { en: "nothing was printed", tl: "walang na-print" },
  "export.failed": {
    en: "This export couldn't be recorded in the access trail, so {nothing}. Try again.",
    tl: "Hindi naitala sa talaan ng access ang export na ito, kaya {nothing}. Subukang muli.",
  },
  "export.refused": {
    en: "Not permitted: this account can't record an export, so {nothing}.",
    tl: "Hindi pinapayagan: hindi makapagtala ng export ang account na ito, kaya {nothing}.",
  },
  "export.sessionExpired": {
    en: "Your session expired, so the export wasn't recorded and {nothing}. Sign in again.",
    tl: "Nag-expire ang iyong session, kaya hindi naitala ang export at {nothing}. Mag-sign in muli.",
  },
  "export.unreachable": {
    en: "Couldn't reach the server to record the export, so {nothing}. Check your connection, then try again.",
    tl: "Hindi maabot ang server para itala ang export, kaya {nothing}. Tingnan ang iyong koneksyon, saka subukang muli.",
  },
  "export.noAnswer": {
    en: "Couldn't confirm the export was recorded, so {nothing}. Check your connection, then try again.",
    tl: "Hindi makumpirma kung naitala ang export, kaya {nothing}. Tingnan ang iyong koneksyon, saka subukang muli.",
  },
  "audit.exported": { en: "Exported {count} events as CSV", tl: "Na-export ang {count} pangyayari bilang CSV" },
  "city.access.action.exported": { en: "Data exported", tl: "Nag-export ng datos" },
  "city.access.range.from": { en: "From", tl: "Mula" },
  "city.access.range.to": { en: "To", tl: "Hanggang" },
  "city.access.range.apply": { en: "Show these dates", tl: "Ipakita ang mga petsang ito" },
  "city.access.range.clear": { en: "Clear dates", tl: "Alisin ang mga petsa" },
  "city.access.range.footer": { en: "Dates: {from} to {to}.", tl: "Mga petsa: {from} hanggang {to}." },
  "city.access.range.open": { en: "any", tl: "kahit kailan" },
  "city.access.emptyRange": {
    en: "No recorded events match these dates and this kind of event.",
    tl: "Walang naitalang pangyayari na tumutugma sa mga petsa at uri ng pangyayaring ito.",
  },
  // On an opening of the access log: which view was opened. On an export:
  // what was exported ({what} is one of export.kind.*) and how many rows.
  "city.access.detail.view": { en: "View: {view}", tl: "Tanaw: {view}" },
  "city.access.detail.export": { en: "{what} · {count} rows", tl: "{what} · {count} hilera" },
  "city.access.detail.exportOne": { en: "{what} · 1 row", tl: "{what} · 1 hilera" },
  "export.kind.validation_history_csv": { en: "Validation History, CSV", tl: "Kasaysayan ng Pag-validate, CSV" },
  "export.kind.validation_history_print": { en: "Validation History, print", tl: "Kasaysayan ng Pag-validate, print" },
  "export.kind.audit_log_csv": { en: "Audit Log, CSV", tl: "Talaan ng Audit, CSV" },
  "export.kind.access_log_csv": { en: "Access log, CSV", tl: "Talaan ng access, CSV" },
  "export.kind.access_log_print": { en: "Access log, print", tl: "Talaan ng access, print" },
  "export.kind.verification_activity_csv": {
    en: "Weekly Verification Activity, CSV",
    tl: "Lingguhang Aktibidad ng Pag-verify, CSV",
  },
  "export.kind.verification_activity_print": {
    en: "Weekly Verification Activity, print",
    tl: "Lingguhang Aktibidad ng Pag-verify, print",
  },

  // --- Reports: #13 Weekly Verification Activity by Official -----------------
  "common.shareOf": { en: "{part} of {whole} ({percent}%)", tl: "{part} sa {whole} ({percent}%)" },
  "reports.verification.title": {
    en: "Weekly Verification Activity by Official",
    tl: "Lingguhang Aktibidad ng Pag-verify bawat Opisyal",
  },
  "reports.verification.intro": {
    en: "Tier 1 verifications made in the seven days shown, by the official who attested and how residency was established.",
    tl: "Mga Tier 1 na pag-verify sa pitong araw na ipinapakita, ayon sa opisyal na nagpatotoo at sa paraan ng patotoo.",
  },
  "reports.verification.weekEnding": { en: "Week ending", tl: "Linggong nagtatapos sa" },
  "reports.verification.thisWeek": { en: "This week", tl: "Ngayong linggo" },
  "reports.verification.col.promotions": { en: "Tier 1 promotions", tl: "Na-promote sa Tier 1" },
  "reports.verification.col.other": { en: "Other method", tl: "Ibang paraan" },
  "reports.verification.col.revoked": { en: "Revoked since", tl: "Binawi mula noon" },
  "reports.verification.total": { en: "Total", tl: "Kabuuan" },
  "reports.verification.caption": {
    en: "Tier 1 verifications by official, {range}",
    tl: "Mga Tier 1 na pag-verify bawat opisyal, {range}",
  },
  "reports.verification.empty": {
    en: "No Tier 1 verification was made in {range}.",
    tl: "Walang Tier 1 na pag-verify na ginawa noong {range}.",
  },
  "reports.verification.failed": {
    en: "The weekly verification activity couldn't load. Refresh the page; the other reports are unaffected.",
    tl: "Hindi na-load ang lingguhang aktibidad ng pag-verify. I-refresh ang page; hindi apektado ang ibang ulat.",
  },
  "reports.verification.footer": {
    en:
      "Revoked since counts this week's verifications that a senior barangay admin has revoked, up to now: the nearest record there is of a verification being contested. " +
      "The export and the print name officials, so each is recorded in the access trail.",
    tl:
      "Binibilang ng Binawi mula noon ang mga pag-verify ngayong linggo na binawi na ng senior admin ng barangay hanggang ngayon: ito ang pinakamalapit na tala ng pagtutol sa isang pag-verify. " +
      "Pinapangalanan ng export at ng print ang mga opisyal, kaya itinatala ang bawat isa sa talaan ng access.",
  },
  "reports.verification.capped": {
    en: "Only the newest {limit} verifications of the week were counted",
    tl: "Ang pinakabagong {limit} pag-verify lamang ng linggo ang nabilang",
  },
  "reports.verification.exported": {
    en: "Exported the verification activity for {range} as CSV",
    tl: "Na-export ang aktibidad ng pag-verify para sa {range} bilang CSV",
  },
  "reports.verification.exportNothing": { en: "Nothing to export for this week", tl: "Walang mai-e-export para sa linggong ito" },

  // --- City: verification quality ---------------------------------------------
  "nav.cityVerification": { en: "Verification quality", tl: "Kalidad ng pag-verify" },
  "banner.what.cityVerification": { en: "Verification quality", tl: "kalidad ng pag-verify" },
  "city.verification.title": { en: "Verification quality by barangay", tl: "Kalidad ng pag-verify bawat barangay" },
  "city.verification.intro": {
    en: "Tier 1 verification over the last {days} days: what each barangay attested, how much of it was later revoked, and how often its verified residents' reports were closed as false.",
    tl: "Tier 1 na pag-verify sa nakaraang {days} araw: ang pinatotohanan ng bawat barangay, gaano karami ang binawi kalaunan, at gaano kadalas isinara bilang hindi totoo ang mga ulat ng mga beripikado nitong residente.",
  },
  "city.verification.tile.promotions": { en: "Tier 1 promotions", tl: "Na-promote sa Tier 1" },
  "city.verification.tile.revoked": { en: "Revoked since", tl: "Binawi mula noon" },
  "city.verification.tile.false": { en: "False reports, verified residents", tl: "Hindi totoong ulat, beripikadong residente" },
  "city.verification.col.promotions": { en: "Tier 1 promotions", tl: "Na-promote sa Tier 1" },
  "city.verification.col.officials": { en: "Verifying officials", tl: "Mga opisyal na nag-verify" },
  "city.verification.col.false": { en: "False reports, verified residents", tl: "Hindi totoong ulat, beripikadong residente" },
  "city.verification.col.trend": { en: "{days}-day trend", tl: "Takbo sa {days} araw" },
  "city.verification.aboveCity": { en: "Above the city's rate", tl: "Mas mataas sa rate ng lungsod" },
  "city.verification.trendSummary": {
    en: "Promotions per day over {days} days; the busiest day had {busiest}.",
    tl: "Mga na-promote bawat araw sa loob ng {days} araw; {busiest} sa pinakaabalang araw.",
  },
  "city.verification.caption": {
    en: "Tier 1 verification by barangay over the last {days} days",
    tl: "Tier 1 na pag-verify bawat barangay sa nakaraang {days} araw",
  },
  "city.verification.empty": {
    en: "No barangay has verified a resident in the last {days} days.",
    tl: "Walang barangay na nag-verify ng residente sa nakaraang {days} araw.",
  },
  "city.verification.outcomesUnavailable": {
    en: "The false-report figures couldn't load, so that column is blank. The verification counts are current.",
    tl: "Hindi na-load ang bilang ng hindi totoong ulat, kaya blangko ang column na iyon. Napapanahon ang bilang ng pag-verify.",
  },
  "city.verification.footer": {
    en:
      "False reports, verified residents: of the reports agencies closed in this period that came from residents who were verified when the agency closed the report, the share closed as false. " +
      "A barangay is marked when its share is above the city's on at least {min} closed reports. " +
      "Revoked since counts the period's verifications that have been revoked up to now. No official or resident is named here.",
    tl:
      "Hindi totoong ulat, beripikadong residente: sa mga ulat na isinara ng mga ahensya sa panahong ito mula sa mga residenteng beripikado nang isara ng ahensya ang ulat, ang bahaging isinara bilang hindi totoo. " +
      "Minamarkahan ang barangay kapag mas mataas ang bahagi nito kaysa sa lungsod sa hindi bababa sa {min} isinarang ulat. " +
      "Binibilang ng Binawi mula noon ang mga pag-verify sa panahong ito na binawi na hanggang ngayon. Walang opisyal o residenteng pinangangalanan dito.",
  },
  "city.verification.capped": {
    en: "Only the newest {limit} records were counted.",
    tl: "Ang pinakabagong {limit} tala lamang ang nabilang.",
  },
  "city.verification.exported": {
    en: "Exported verification quality as CSV",
    tl: "Na-export ang kalidad ng pag-verify bilang CSV",
  },
  // --- Report chat (behind REPORT_CHAT_LIVE) ---
  "row.chat": { en: "Chat", tl: "Chat" },
  "row.chatLabel": { en: "Chat with the reporter of {id}", tl: "Makipag-chat sa nag-ulat ng {id}" },
  "chat.title": {
    en: "Message the reporter",
    tl: "Mensahe sa nag-ulat",
  },
  "chat.closeWarning": {
    en: "Text only. Three days after the report is closed, this chat becomes read-only. Messages are kept with the report.",
    tl: "Teksto lamang. Tatlong araw matapos maisara ang ulat, magiging read-only ang chat na ito. Mananatili ang mga mensahe sa ulat.",
  },
  "chat.loading": {
    en: "Loading messages...",
    tl: "Kinukuha ang mga mensahe...",
  },
  "chat.loadFailed": {
    en: "Messages could not be loaded.",
    tl: "Hindi makuha ang mga mensahe.",
  },
  "chat.notLive": {
    en: "Live updates are off; refreshing every 30 seconds.",
    tl: "Walang live update; nagre-refresh bawat 30 segundo.",
  },
  "chat.capped": {
    en: "Only the newest messages are shown.",
    tl: "Ang pinakabagong mga mensahe lamang ang ipinapakita.",
  },
  "chat.empty": {
    en: "No messages yet.",
    tl: "Wala pang mensahe.",
  },
  "chat.fromDesk": {
    en: "Barangay desk",
    tl: "Barangay desk",
  },
  "chat.fromReporter": {
    en: "Reporter",
    tl: "Nag-ulat",
  },
  "chat.read": {
    en: "Read",
    tl: "Nabasa",
  },
  "chat.composerLabel": {
    en: "Message to the reporter",
    tl: "Mensahe sa nag-ulat",
  },
  "chat.send": {
    en: "Send",
    tl: "Ipadala",
  },
  "chat.readOnly": {
    en: "This chat is read-only because the report was closed more than 3 days ago.",
    tl: "Read-only na ang chat dahil mahigit 3 araw nang naisara ang ulat.",
  },
  "chat.err.invalid": {
    en: "Write 1 to 1000 characters.",
    tl: "Sumulat ng 1 hanggang 1000 character.",
  },
  "chat.err.discreet": {
    en: "A discreet report has no chat.",
    tl: "Walang chat ang discreet na ulat.",
  },
  "chat.err.closed": {
    en: "This chat is read-only now.",
    tl: "Read-only na ang chat na ito.",
  },
  "chat.err.rateLimited": {
    en: "Too many messages. Try again in a few minutes.",
    tl: "Masyadong maraming mensahe. Subukan muli pagkalipas ng ilang minuto.",
  },
  "chat.err.dailyCap": {
    en: "Daily limit reached: 100 messages per report in 24 hours. Try again tomorrow.",
    tl: "Naabot na ang limitasyon sa isang araw: 100 mensahe bawat ulat sa loob ng 24 oras. Subukan muli bukas.",
  },
  "chat.lockNotice": {
    en: "The report is closed. This chat becomes read-only on {date}.",
    tl: "Sarado na ang ulat. Magiging read-only ang chat na ito sa {date}.",
  },
  "chat.err.notAccepting": {
    en: "This chat is not taking messages.",
    tl: "Hindi tumatanggap ng mensahe ang chat na ito.",
  },
  "chat.err.refused": {
    en: "You cannot message on this report.",
    tl: "Hindi ka maaaring magpadala ng mensahe sa ulat na ito.",
  },
  "chat.err.noBarangay": {
    en: "Your account has no barangay assigned.",
    tl: "Walang nakatalagang barangay ang account mo.",
  },
  "chat.err.sessionExpired": {
    en: "Your session expired. Sign in again.",
    tl: "Nag-expire ang session mo. Mag-sign in muli.",
  },
  "chat.err.unreachable": {
    en: "No connection. The message was not sent.",
    tl: "Walang koneksyon. Hindi naipadala ang mensahe.",
  },
  "chat.err.off": {
    en: "Chat is not switched on.",
    tl: "Hindi pa naka-on ang chat.",
  },
  "chat.err.failed": {
    en: "The message was not sent.",
    tl: "Hindi naipadala ang mensahe.",
  },
  "chat.err.noAnswer": {
    en: "No answer from the server. The message may or may not have been sent; check the thread.",
    tl: "Walang sagot ang server. Maaaring naipadala o hindi; tingnan ang thread.",
  },
  // --- Report chat v2 (behind REPORT_CHAT_V2) ---
  "chat.v2.tabsLabel": {
    en: "Chat threads",
    tl: "Mga thread ng chat",
  },
  "chat.v2.tab.group": {
    en: "Group",
    tl: "Grupo",
  },
  "chat.v2.tab.desk": {
    en: "Desk · staff only",
    tl: "Desk · kawani lamang",
  },
  "chat.v2.title.group": {
    en: "Reporter, barangay and agencies",
    tl: "Nag-ulat, barangay at mga ahensya",
  },
  "chat.v2.title.desk": {
    en: "Barangay desk and agencies",
    tl: "Barangay desk at mga ahensya",
  },
  "chat.v2.groupNote": {
    en: "The reporter and every agency this report is routed to read this thread, earlier messages included.",
    tl: "Nababasa ng nag-ulat at ng bawat ahensyang pinagpasahan ng ulat ang thread na ito, kasama ang mga naunang mensahe.",
  },
  "chat.v2.deskNote": {
    en: "Staff only: the barangay desk and the agencies this report is routed to. The reporter never sees this thread.",
    tl: "Para sa kawani lamang: ang barangay desk at ang mga ahensyang pinagpasahan ng ulat. Hindi kailanman makikita ng nag-ulat ang thread na ito.",
  },
  "chat.v2.openedBy": {
    en: "Opened by",
    tl: "Binuksan ng",
  },
  "chat.v2.openedByNone": {
    en: "no agency yet",
    tl: "wala pang ahensya",
  },
  "chat.v2.openedSeen": {
    en: "{agency} opened this thread on {date} and has seen the latest message.",
    tl: "Binuksan ng {agency} ang thread na ito noong {date} at nakita na ang pinakabagong mensahe.",
  },
  "chat.v2.openedNotSeen": {
    en: "{agency} opened this thread on {date} and has not seen the latest message yet.",
    tl: "Binuksan ng {agency} ang thread na ito noong {date} pero hindi pa nakikita ang pinakabagong mensahe.",
  },
  "chat.v2.seenBy": {
    en: "Seen by {names}",
    tl: "Nakita na ng {names}",
  },
  "chat.v2.agencyFallback": {
    en: "Agency",
    tl: "Ahensya",
  },
  "chat.v2.composerLabel.group": {
    en: "Message to the reporter and the agencies",
    tl: "Mensahe sa nag-ulat at sa mga ahensya",
  },
  "chat.v2.composerLabel.desk": {
    en: "Message to the agencies, staff only",
    tl: "Mensahe sa mga ahensya, kawani lamang",
  },
  "chat.v2.agencyConsentPending": {
    en: "Agencies can't see this chat until the resident accepts the updated consent.",
    tl: "Hindi pa makikita ng mga ahensya ang chat na ito hangga't hindi tinatanggap ng residente ang na-update na pahintulot.",
  },
  // --- Report chat media (behind REPORT_CHAT_MEDIA) ---
  "chat.media.closeWarning": {
    en: "Text, photos and short videos. Three days after the report is closed, this chat becomes read-only. Messages and files are kept with the report.",
    tl: "Teksto, larawan at maikling video. Tatlong araw matapos maisara ang ulat, magiging read-only ang chat na ito. Mananatili ang mga mensahe at file sa ulat.",
  },
  "chat.media.attach": {
    en: "Attach photos or a video",
    tl: "Maglakip ng larawan o video",
  },
  "chat.media.attachHint": {
    en: "Up to 4 photos, or 1 MP4 video of at most 30 seconds and 25 MB",
    tl: "Hanggang 4 na larawan, o 1 MP4 na video na hindi lalampas sa 30 segundo at 25 MB",
  },
  "chat.media.pickedLabel": {
    en: "Files to send",
    tl: "Mga file na ipapadala",
  },
  "chat.media.pickedPhoto": {
    en: "Photo {n} to send",
    tl: "Larawan {n} na ipapadala",
  },
  "chat.media.remove": {
    en: "Remove file {n}",
    tl: "Alisin ang file {n}",
  },
  "chat.media.preparing": {
    en: "Preparing files...",
    tl: "Inihahanda ang mga file...",
  },
  "chat.media.uploading": {
    en: "Uploading {n} of {total}...",
    tl: "Ina-upload ang {n} sa {total}...",
  },
  "chat.media.video": {
    en: "Video",
    tl: "Video",
  },
  "chat.media.openPhoto": {
    en: "Open photo {n} of {total} from {name}",
    tl: "Buksan ang larawan {n} sa {total} mula sa {name}",
  },
  "chat.media.openVideo": {
    en: "Open video from {name}, {length}",
    tl: "Buksan ang video mula sa {name}, {length}",
  },
  "chat.media.loading": {
    en: "Loading files...",
    tl: "Kinukuha ang mga file...",
  },
  "chat.media.loadFailed": {
    en: "The files could not be loaded.",
    tl: "Hindi makuha ang mga file.",
  },
  "chat.media.retry": {
    en: "Retry",
    tl: "Subukan muli",
  },
  "chat.media.unavailable": {
    en: "Files not available.",
    tl: "Hindi available ang mga file.",
  },
  "chat.media.photoFailed": {
    en: "Could not load this file.",
    tl: "Hindi ma-load ang file na ito.",
  },
  "chat.media.viewerPhoto": {
    en: "Photo",
    tl: "Larawan",
  },
  "chat.media.viewerVideo": {
    en: "Video",
    tl: "Video",
  },
  "chat.media.photoAlt": {
    en: "Photo sent in the report chat",
    tl: "Larawang ipinadala sa chat ng ulat",
  },
  "chat.media.position": {
    en: "{n} of {total}",
    tl: "{n} sa {total}",
  },
  "chat.media.previous": {
    en: "Previous photo",
    tl: "Nakaraang larawan",
  },
  "chat.media.next": {
    en: "Next photo",
    tl: "Susunod na larawan",
  },
  "chat.media.pick.tooMany": {
    en: "A message can carry up to 4 photos or 1 video.",
    tl: "Hanggang 4 na larawan o 1 video lamang ang maaaring isama sa isang mensahe.",
  },
  "chat.media.pick.mixed": {
    en: "Send photos and a video in separate messages.",
    tl: "Ipadala ang mga larawan at ang video sa magkahiwalay na mensahe.",
  },
  "chat.media.pick.fileType": {
    en: "Only photos and MP4 videos can be attached.",
    tl: "Mga larawan at MP4 na video lamang ang maaaring ilakip.",
  },
  "chat.media.pick.photoUnreadable": {
    en: "This photo could not be read. Try a JPEG or PNG.",
    tl: "Hindi mabasa ang larawang ito. Subukan ang JPEG o PNG.",
  },
  "chat.media.pick.photoMetadata": {
    en: "This photo still carried location data after preparing it, so it was not attached.",
    tl: "May dala pa ring datos ng lokasyon ang larawang ito, kaya hindi ito inilakip.",
  },
  "chat.media.pick.tooLarge": {
    en: "The file is larger than 25 MB.",
    tl: "Lampas sa 25 MB ang file.",
  },
  "chat.media.pick.videoUnreadable": {
    en: "This video's length could not be read, so it was not attached.",
    tl: "Hindi mabasa ang haba ng video na ito, kaya hindi ito inilakip.",
  },
  "chat.media.pick.videoTooLong": {
    en: "The video is longer than 30 seconds.",
    tl: "Lampas sa 30 segundo ang video.",
  },
  "chat.media.pick.videoNotMp4": {
    en: "Only MP4 videos can be attached.",
    tl: "MP4 na video lamang ang maaaring ilakip.",
  },
  "chat.media.pick.videoLocation": {
    en: "This video records where it was taken, so it was not attached. Send a photo instead, or a video recorded with location tags off.",
    tl: "Nakatala sa video na ito kung saan ito kinunan, kaya hindi ito inilakip. Magpadala na lang ng larawan, o ng video na kinunan nang naka-off ang location tag.",
  },
  "chat.media.err.invalid": {
    en: "The files were refused. Check that they are within the limits and try again.",
    tl: "Tinanggihan ang mga file. Tiyaking pasok ang mga ito sa limitasyon at subukan muli.",
  },
  "chat.media.err.missing": {
    en: "An uploaded file could not be found. Try sending again.",
    tl: "Hindi makita ang isang na-upload na file. Subukang ipadala muli.",
  },
  "chat.media.err.uploadRefused": {
    en: "The upload was refused: the chat may be read-only, or too many files were sent in a short time.",
    tl: "Tinanggihan ang pag-upload: maaaring read-only na ang chat, o masyadong maraming file ang naipadala sa maikling oras.",
  },
  "chat.media.err.tooLarge": {
    en: "A file is larger than 25 MB.",
    tl: "Lampas sa 25 MB ang isang file.",
  },
  "chat.media.err.uploadFailed": {
    en: "A file could not be uploaded. The message was not sent.",
    tl: "Hindi ma-upload ang isang file. Hindi naipadala ang mensahe.",
  },
  "popup.tabsLabel": {
    en: "Report sections",
    tl: "Mga seksyon ng ulat",
  },
  "popup.tab.chat": {
    en: "Chat",
    tl: "Chat",
  },
  "popup.tab.details": {
    en: "Details",
    tl: "Detalye",
  },
  // RECALL-UI (LipaAction docs/specs/2026-10-14-barangay-recall-screen-design.md).
  // The Tagalog in this block is the spec's SUGGESTED wording, or drafted in
  // its style where the spec has none: a DRAFT for the owner's review (spec
  // Q7), not yet reviewed like the rest of this file.
  "recall.strip.title": { en: "Routed without a review here", tl: "Naipasa nang hindi nasuri dito" },
  "recall.strip.body": {
    en: "These reports went to their agencies automatically: a responder filed them, or the Critical escalation timer sent them. While the recall window is open you can take one back for review.",
    tl: "Awtomatikong naipasa sa mga ahensya ang mga ulat na ito: responder ang nag-ulat, o ipinasa ng Critical escalation timer. Habang bukas ang recall window, maaari ninyong bawiin ang isa para suriin.",
  },
  "recall.strip.unavailable": {
    en: "Couldn't load the reports routed automatically. Check Recent validated, or refresh to try again.",
    tl: "Hindi ma-load ang mga ulat na awtomatikong naipasa. Tingnan ang Kamakailang Na-validate, o i-refresh para subukang muli.",
  },
  "recall.strip.recallUnavailable": {
    en: "Recall isn't available right now. These reports are listed so you know where they went.",
    tl: "Hindi magagamit ang Recall ngayon. Nakalista ang mga ulat na ito para malaman ninyo kung saan sila napunta.",
  },
  "recall.strip.closedSummary": {
    en: "{count} more routed automatically: recall window closed or a unit already sent",
    tl: "{count} pang awtomatikong naipasa: sarado na ang recall window o may naipadalang unit na",
  },
  "recall.details": { en: "Details", tl: "Detalye" },
  "recall.routedTo": { en: "Routed automatically to {agencies}", tl: "Awtomatikong naipasa sa {agencies}" },
  "recall.escalatedTo": { en: "Escalated to {agencies}", tl: "Na-escalate sa {agencies}" },
  "recall.responder": { en: "Responder: {unit}", tl: "Responder: {unit}" },
  "recall.timeLeft": { en: "{time} left to recall", tl: "{time} na lang para bawiin" },
  "recall.timeLeftUnderMinute": {
    en: "{time} left to recall, less than a minute",
    tl: "{time} na lang para bawiin, wala nang isang minuto",
  },
  "recall.windowClosed": { en: "Recall window closed", tl: "Sarado na ang recall window" },
  "recall.noWindow": { en: "No recall window for this priority", tl: "Walang recall window ang priority na ito" },
  "recall.dispatchedNote": {
    en: "{agency} has sent a unit or started work",
    tl: "Nakapagpadala na ng unit o nagsimula na ang {agency}",
  },
  "recall.anAgency": { en: "An agency", tl: "Isang ahensya" },
  "recall.button": { en: "Recall", tl: "Bawiin" },
  "recall.buttonFor": { en: "Recall {id}", tl: "Bawiin ang {id}" },
  "recall.record": { en: "Record recall", tl: "Itala ang pagbawi" },
  "recall.recordFor": { en: "Record recall for {id}", tl: "Itala ang pagbawi sa {id}" },
  "recall.live.oneMinute": { en: "1 minute left to recall {id}.", tl: "1 minuto na lang para bawiin ang {id}." },
  "recall.live.closed": { en: "Recall window closed for {id}.", tl: "Sarado na ang recall window ng {id}." },
  "row.escalated": { en: "Escalated", tl: "Na-escalate" },
  "row.recallOpen": { en: "Recall window open", tl: "Bukas ang recall window" },
  "row.recalledChip": { en: "Recalled by your barangay", tl: "Binawi ng inyong barangay" },
  "drawer.escalated": {
    en: "Routed automatically because no one here acted on this Critical report in time.",
    tl: "Awtomatikong naipasa dahil walang kumilos dito sa Critical na ulat na ito sa takdang oras.",
  },
  "recall.title": { en: "Recall {id} from the agencies?", tl: "Bawiin ang {id} mula sa mga ahensya?" },
  "recall.desc.open": {
    en: "The report comes back to your Emergency queue for review, and {agencies} are told it was recalled. If any agency has already sent a unit, nothing is recalled from any agency; your recall is only recorded.",
    tl: "Babalik ang ulat sa inyong Emergency queue para suriin, at sasabihan ang {agencies} na binawi ito. Kung nakapagpadala na ng unit ang alinmang ahensya, walang babawiin sa alinmang ahensya; itatala lang ang inyong pagbawi.",
  },
  "recall.desc.escalated": {
    en: "The automatic escalation will not send it again; your desk must route it.",
    tl: "Hindi na ito muling ipapasa ng awtomatikong escalation; ang inyong desk ang dapat magpasa nito.",
  },
  "recall.desc.dispatched": {
    en: "{agency} has already sent a unit or started work, so nothing is recalled from any agency. A recall now is only recorded in the audit log; the agencies keep the report.",
    tl: "Nakapagpadala na ng unit o nagsimula na ang {agency}, kaya walang babawiin sa alinmang ahensya. Itatala lang sa audit log ang pagbawi ngayon; mananatili ang ulat sa mga ahensya.",
  },
  "recall.desc.closed": {
    en: "The recall window closed {minutes} min ago. A recall now is only recorded in the audit log; the agencies keep the report.",
    tl: "Nagsara ang recall window {minutes} minuto na ang nakalipas. Itatala lang sa audit log ang pagbawi ngayon; mananatili ang ulat sa mga ahensya.",
  },
  "recall.desc.noWindow": {
    en: "This priority has no recall window. A recall now is only recorded in the audit log; the agencies keep the report.",
    tl: "Walang recall window ang priority na ito. Itatala lang sa audit log ang pagbawi ngayon; mananatili ang ulat sa mga ahensya.",
  },
  "recall.desc.none": {
    en: "This report can no longer be recalled. Refresh to see where it stands.",
    tl: "Hindi na mababawi ang ulat na ito. I-refresh para makita ang kalagayan nito.",
  },
  "recall.severityLegend": { en: "What went wrong? (required)", tl: "Ano ang naging mali? (kailangan)" },
  "recall.severity.none": { en: "None — recalling as a precaution", tl: "Wala — pag-iingat lang" },
  "recall.severity.safety_net_trip": {
    en: "Safety-net trip — the reporter's answers were wrong",
    tl: "Safety-net — mali ang mga sagot ng nag-ulat",
  },
  "recall.severity.classifier_wrong": {
    en: "Classifier wrong — the priority is wrong",
    tl: "Mali ang classifier — mali ang priority",
  },
  "recall.severity.agency_mismatch": { en: "Agency mismatch — wrong agency", tl: "Maling ahensya" },
  "recall.reasonLabel": {
    en: "Reason, required (the agencies see this)",
    tl: "Dahilan, kailangan (makikita ito ng mga ahensya)",
  },
  "recall.reasonCount": { en: "{n}/500 characters", tl: "{n}/500 character" },
  "recall.result.recalled": {
    en: "Recalled. {id} is back in your Emergency queue for review; the agencies were told.",
    tl: "Nabawi. Bumalik ang {id} sa inyong Emergency queue para suriin; sinabihan ang mga ahensya.",
  },
  "recall.result.after_window": {
    en: "The recall window had closed. Your recall is on record; the agencies keep the report.",
    tl: "Sarado na ang recall window. Naitala ang inyong pagbawi; mananatili ang ulat sa mga ahensya.",
  },
  "recall.result.after_window_no_window": {
    en: "This priority has no recall window. Your recall is on record; the agencies keep the report.",
    tl: "Walang recall window ang priority na ito. Naitala ang inyong pagbawi; mananatili ang ulat sa mga ahensya.",
  },
  "recall.result.after_dispatch": {
    en: "An agency has already sent a unit or started work, so nothing was recalled from any agency. Your recall is on record; the agencies keep the report.",
    tl: "May naipadalang unit na o nagsimula na ang isang ahensya, kaya walang nabawi sa alinmang ahensya. Naitala ang inyong pagbawi; mananatili ang ulat sa mga ahensya.",
  },
  "recall.result.not-permitted": {
    en: "Not permitted: wrong barangay, or the report no longer exists.",
    tl: "Hindi pinapayagan: ibang barangay, o wala na ang ulat.",
  },
  "recall.result.invalid": {
    en: "Choose what went wrong and type a reason (up to 500 characters).",
    tl: "Piliin kung ano ang naging mali at mag-type ng dahilan (hanggang 500 character).",
  },
  "recall.result.stale": {
    en: "This report can no longer be recalled: someone already recalled or reviewed it, or every agency has closed it. Refresh to see where it stands.",
    tl: "Hindi na mababawi ang ulat na ito: may nakabawi o nakasuri na, o isinara na ito ng lahat ng ahensya. I-refresh para makita ang kalagayan nito.",
  },
  "recall.result.unavailable": {
    en: "Recall isn't available on the server yet. Nothing was recalled.",
    tl: "Wala pang Recall sa server. Walang nabawi.",
  },
  "recall.result.unreachable": {
    en: "Couldn't reach the server. Check your connection, then try again.",
    tl: "Hindi maabot ang server. Tingnan ang inyong koneksyon, saka subukang muli.",
  },
  "recall.result.session-expired": {
    en: "Your session expired. Sign in again.",
    tl: "Nag-expire ang inyong session. Mag-sign in muli.",
  },
  "recall.result.unknown": {
    en: "Something went wrong. The report wasn't recalled — try again.",
    tl: "May nangyaring mali. Hindi nabawi ang ulat — subukang muli.",
  },
  "recall.badge": { en: "{count} routed without you", tl: "{count} naipasa nang wala kayo" },
  "recall.badgeLabel": {
    en: "{count} new reports routed without a review here. Show them.",
    tl: "{count} bagong ulat na naipasa nang hindi nasuri dito. Ipakita.",
  },
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof MESSAGES;
