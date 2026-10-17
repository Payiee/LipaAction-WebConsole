# LipaAction — Barangay Web Console

The officials-facing web console for the LipaAction incident-reporting system, as
specified in **Chapter 3, Section 3.7.3** of the LipaAction thesis (Major Revision,
May 2026). Barangay officials use it to review, validate, and reject incident reports
submitted by residents through the LipaAction mobile app, and barangay administrators
use it to verify residents (Tier 1) and to lift the sanctions that false reports bring.

The same console also carries a read-only city dashboard for the municipal
administrator (**Section 3.7.5** and **Appendix A.5**): city-wide report activity per
barangay, a map of open reports, a city-wide report list, each agency's response
times, verification quality per barangay, the agency list, and an access log naming the
officials who opened and acted on reports.

This is a working implementation against the project's shared Supabase backend — not
a static mockup. Sign-in is real, report data is real, and validating or rejecting a
report writes to the production database through the same review path the rest of the
system uses.

**Deployed:** <https://lipa-action-web-console.vercel.app> — Vercel, as specified in
Chapter 3. Only pre-provisioned barangay officials and city administrators can sign
in; an unknown email address does not create an account.

## Tech stack

Follows the stack specified in Chapter 3, Section 3.8.3 (Technology Stack) for the
officials' web dashboards. Tailwind CSS was added for styling, since the thesis text
does not specify a CSS framework.

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS**
- **Supabase** (Postgres, Auth, Row Level Security) via `@supabase/ssr`

There is no test suite. Verification is `npx tsc --noEmit`, `npm run lint`,
`npm run build`, and two plain-Node self-checks of pure modules, `npm run check:cdrrmo`
and `npm run check:recall` (Node 22.18 or later).

## Getting started

```bash
npm install
```

Create `.env.local` in the project root with the Supabase project URL and anon key:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Only the public anon key is used. Every read and write runs as the signed-in official
under Row Level Security; the service-role key is never needed and must not be added.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It redirects to `/login`, and
after sign-in to `/queue`.

### Deploying

The same two variables are the whole configuration — set them on the host for both
production and preview builds. They are read at build time as well as at run time,
because they are `NEXT_PUBLIC_`.

One step belongs to Supabase rather than the host: add `https://<your-domain>/auth/callback`
to **Authentication → URL Configuration → Redirect URLs**, including the scheme. The
emailed sign-in link is refused otherwise, and Supabase falls back to the project's
Site URL. Don't add a wildcard for a shared hosting domain such as `*.vercel.app`;
that would make any site on that domain a valid destination for sign-in tokens.

`vercel.json` pins the server functions to Singapore (`sin1`), next to the Supabase
project. Without it Vercel runs them in Washington DC, and every database call a page
makes crosses the Pacific twice. If the Supabase project is ever moved, move this too.

## Signing in

Login is passwordless. An official enters their email, receives a one-time code, and
types it back into the same tab. Clicking the link in the email works as a fallback.
An official whose address the email service cannot reach can be given a code made by an
administrator on the server: [I already have a code] on the sign-in page goes straight
to the code box and sends nothing, so the code that was handed over stays valid.

Only pre-provisioned accounts can sign in — the login form is configured with
`shouldCreateUser: false`, so an unknown email address does not create an account.
Accounts are created by an administrator in Supabase.

Every page checks the signed-in user's profile role on the server before rendering.
Only `barangay_official`, `barangay_admin`, and `senior_barangay_admin` are admitted;
a `municipal_admin` account is sent to the city dashboard at `/city`, whose pages admit
only that role and send a barangay official back to their queue. Verify Resident and
Sanctions admit only `barangay_admin` and `senior_barangay_admin`, and send a
`barangay_official` back to the queue. Any other role is
redirected to `/not-authorized`, which offers sign-out so a differently-scoped account
can be used instead. A signed-in user who opens `/login`
is sent to the console. The signed-in official's name, role, and barangay are shown
throughout the interface.

A city account signs in with a second step (thesis A.5.1). After the emailed code, it is
asked for a 6-digit code from an authenticator app on the administrator's phone (Google
Authenticator, Microsoft Authenticator, or any app that reads the same codes). The first
sign-in sets this up once: the page shows a QR code to scan, with a key to type instead,
and the set-up is complete when a code from the app is accepted. No city page opens for
a session that has not passed this step. Barangay sign-in is unchanged. A lost phone
means asking the system's administrator to reset the account's second step in Supabase;
the console cannot reset it. A reset there should also end the account's open sessions: a browser already past the step keeps the city pages until its token expires, up to an hour. Set-up belongs to whoever signs in first, so each city account's authenticator is set up on the day the account is handed over, with the system's administrator present.

All times are shown in Philippine Standard Time regardless of where the server or the
official's browser is set.

## Pages

| Page | Status |
|------|--------|
| **Queue** | Live. Shows the barangay's pending reports in four tabs — Emergency Fast-triage, Standard intake, Flagged duplicates, Recent validated — with a search box, a sort (by priority score, newest first, or oldest first) and a detail view, opened as a dialog over the queue, showing the resident's full account and the classifier's reading of the report on one side and, on the other, the report's chat in two tabs. Group is the thread with the resident and every agency the report is routed to, which an agency routed later reads in full, earlier messages included; until the resident accepts the updated consent notice that covers agency chat, the tab says agencies can't see it yet. Desk · staff only, offered once the report has been routed, is a thread between the barangay desk and those agencies that the resident never sees. Each message says whether the resident, the barangay desk or which agency wrote it, and each thread shows which agencies have opened it and seen the latest message. Both threads become read-only three days after the report is closed; a report filed discreetly has no chat at all, since contacting that resident is what discreet reporting forbids. Each row also carries a Chat button that opens the dialog on the chat, both while the report awaits review and after it has been validated and handed to agencies. On a narrow screen the two sides become tabs, and the tab strip and filter rows scroll sideways instead of stacking. Validate and Reject write to the database; rejection requires one of the thesis's reason categories (wrong category, already resolved, mistaken identity, not an emergency, duplicate, or other) plus an optional note, required for Other. Before a report is validated, its detail drawer shows which agencies are recommended for its category. The drawer also shows a small street map, with coordinates, of where the reporter's phone was when they filed, which can be expanded to fill the screen, except for a report whose resident withheld their identity or asked for discreet reporting, whose location is never read. A report whose resident asked for discreet handling is marked as such on its row, opens with a do-not-contact banner (Discreet report: do not call or text the reporter), and is flagged again in the routing confirmation. A report whose resident answered that the emergency had already resolved is marked Already resolved, review. A validated report, emergency or Standard intake, is then routed to the agencies the official chooses for it, like tagging it with the offices it belongs to, because not every office is on duty around the clock: Route to agency opens a list of agencies in which the ones its category usually goes to are marked Recommended and nothing is ticked in advance, the official ticks the ones on duty (or others), and the first one ticked leads. A category with no mapped agency can be routed the same way. With the backend's CDRRMO dispatch switched on, an emergency's Validate opens that same list instead, and validating sends it to the agencies ticked, with CDRRMO always added (as a supporting agency unless ticked); if the agency list could not be loaded, validating sends it to CDRRMO alone, which can pass it on; the Recent validated tab separates reports awaiting routing from those already with agencies, lists the latter by when they were routed, newest first, and shows each agency's progress (acknowledged, in progress, resolved, or closed with an outcome) as the agency records it, usually within a second. A validated Other-report (not an emergency) can instead be resolved at the barangay, when the barangay handled it itself: the official writes what was done, the report is marked resolved without going to any agency, and it moves to Validation History. This cannot be undone, and it is offered only for a report no agency has held; emergencies always go to an agency. A report that every agency sends back as out of scope, once the database has returned it to the barangay, can be routed to other agencies the official chooses from a list that leaves out the ones that returned it. Opening a report's details is recorded in the access log, once per opening. On the Flagged duplicates tab, reports are shown in the groups duplicate detection made, each group with its categories and its own action to validate every report in it at once; the largest group also appears as a card on the Emergency tab. When a group mixes categories, the confirmation says so. The page updates live as reports change (a Supabase Realtime subscription, filtered to the barangay and enforced by Row-Level Security), falling back to a 30-second refresh if the live channel cannot connect. A report that arrives on its own is marked as new for a few seconds so it is not missed. The page can also chime when a new emergency arrives, and can raise a browser notification when an emergency has waited more than five minutes. If the data cannot be loaded it says so, rather than showing an empty queue. For a barangay admin or senior barangay admin, the tiles add the flagged-duplicates count and the number of sanctions that any admin can lift, with a fifth tile for a senior barangay admin counting those on the malicious track; below the queue, shortcuts open Verify Resident and Sanctions (and, for a senior barangay admin, the residents whose attestation can be revoked), and a recent-activity list shows the barangay's five newest audit events by role, linking to the Audit Log, as the thesis's admin home does. |
| **Cluster Explorer** | Live. Groups pending reports that the duplicate-detection service has marked as the same incident (a shared `cluster_id`, written back since October 2026). The service compares reports from the same barangay filed within 72 hours of each other, weighing place, time and category, so a group can mix categories. The queue's Flagged duplicates tab shows the same groups, and a group can be validated as one action. The grouping can't be changed from the console. Beside the member list, a street map plots where each member's reporter was when they filed, under the same privacy rule as the queue's map (never for an identity-withheld or discreet report, which are counted below the map instead); tapping a dot, or a row, highlights that report in both places and shows its filing time and coordinates. Where several dots share one spot, the map asks which report was meant. The map can be expanded to fill the screen. |
| **Validation History** | Live. Reviewed reports (validated or rejected) with the reviewing official, timestamp, rejection category and note, and, for a confirmed report, what became of it since (not routed yet, resolved at the barangay with the official's note, with agencies, resolved, confirmed false, closed as a duplicate, or returned out of scope). Filters by date range, verdict, official, category (several at once), priority and that resolution outcome, over the rows loaded. Exports the visible rows to CSV, and prints or saves them as a PDF through the browser. Both name the validating officials, so each is recorded in the access trail first and doesn't happen if the record can't be written. |
| **Verify Resident** (`/verify-resident`) | Live, for `barangay_admin` and `senior_barangay_admin`. Tier 1 verification (thesis A.3.9): the barangay's attestation, under RA 7160 Section 389(b), that a resident lives there. Lists the barangay's residents by name, with the last four digits of each one's phone number, the day they registered, and their tier, under three groups (not yet verified, verified, all), with a search by name, by a full phone number, or by a number's last four digits. A resident whose profile carries no name is listed, and named in the dialogs, by the ending of their phone number. Verify asks how residency was established (in person, a field visit, or the barangay's own records) and for the official's own statement, neither preselected, and moves the account to Tier 1; the row then shows who attested, how and when. A senior barangay admin can revoke an attestation with a required reason, which returns the account to Tier 0 and stays on the row. Both go through the backend's functions, which enforce the roles and the barangay. |
| **Sanctions** (`/sanctions`) | Live, for `barangay_admin` and `senior_barangay_admin`. The barangay's active cooldowns and suspensions (thesis A.3.4), which the backend applies when an agency closes a resident's report as confirmed false. One card per sanctioned resident: the track (inaccurate or malicious) and kind, the day a cooldown ends or that a suspension stands until lifted, both strike counts, the trust score, and the resident's strikes and lifts so far, by day. Filters by who may lift: the malicious-track filter holds everything only a senior barangay admin can lift. Lift takes a required reason, shows what the lift will do (the trust score back to 0.5, the cooldown and suspension ended, the tier unchanged) and under whose name, and goes through the backend's function. Anything on the malicious track can be lifted only by a senior barangay admin; for a barangay admin the card says so in place of the button. The report behind a strike is never shown. |
| **Reports** | Live. Three of the thesis's barangay reports, shown one at a time under large Daily, Weekly and Monthly tabs, each exportable as CSV and printable or savable as a PDF through the browser. The Daily Queue Summary (#12): the reports submitted on a chosen day (today by default), by category, counted by where each stands now — awaiting review, validated, or rejected. It can be narrowed to several chosen categories, and the totals, the CSV and a print then hold only those. The Weekly Verification Activity by Official (#13): for the seven days ending on a chosen day, each official's Tier 1 promotions, by how residency was established, and how many of them a senior barangay admin has since revoked; it names officials, so its export and print are recorded in the access trail. The Monthly Resolution Time by Agency (#16): for the routings of the barangay's reports that agencies closed in a chosen month, each agency's median time from routing to resolution (with the 95th percentile once it has 20 timings), with reports returned out of scope counted apart. The rest of the thesis's barangay catalogue is listed with the reason each isn't generated: the weekly false-report rate per reporter (#14) and the monthly resident engagement summary (#17) would set named residents beside the outcomes of their reports, which the console never does; the weekly safety-net trigger summary (#15) needs events nothing records; and monthly recall usage (#18) has nothing to count from here, since the desk's audit log does not include recalls. |
| **Settings** | Profile is live (name, role, barangay, email, phone); the display name is editable. Language and alert preferences are saved in the browser on the current device. The interface language switches the console between English and Tagalog — the same choice as the EN/TL switch at the top right of every page; the alert preferences drive the Queue page's chime and browser notification. Senior barangay administrators default to Tagalog, as the thesis specifies. The bilingual-emphasis setting is recorded but does not yet change any screen, and says so. |
| **City overview** (`/city`) | Live, read-only, for the municipal administrator. City-wide tiles (reports today, the 7-day daily average, reports awaiting review, Critical ones among them, and emergencies waiting more than five minutes), then one row per barangay: its last 7 days as daily bars, today's count, what awaits review now however old, and how many of the week's reports were validated or rejected. No decision or routing controls. Prints or saves as a PDF through the browser. |
| **City map** (`/city/map`) | Live, read-only. Reports still open (awaiting review, validated, or with agencies) from the last 7 days, as dots on an OpenStreetMap street map coloured by priority, each where the reporter's phone was when they filed. A report whose resident withheld their identity or asked for discreet reporting is never placed on the map: it is counted under its barangay beside the map, as are reports sent without a location. Every dot is also listed in a table below the map. Counts by priority sit above the map and cover every open report, the ones kept off it included, and the dots and the table can be narrowed by priority and category. A dot, or Details in the table, opens the report in the city report list, whose drawer records the opening in the access log. |
| **City reports** (`/city/reports`) | Live, read-only. Every report filed in the city in the last 30 days, newest first, filterable by barangay, by stage (awaiting review, validated but not routed, with agencies, rejected), and by several categories at once. The rows shown can be exported as CSV, with no description and no reporter, as on screen; the export is recorded in the access trail first and doesn't happen if the record can't be written. Each row shows its time, barangay, category, priority with score, status, and the agencies holding it with the lead agency's progress. The list shows no description; the detail drawer shows the resident's account, the triage reading and each agency's progress, has no decision or routing controls, and records every opening in the access log, as the queue's drawer does. A report can also be opened straight from the city map. |
| **Agency response** (`/city/response-times`) | Live, read-only. The thesis's per-agency response time view: for every routing in the last 30 days, per agency, how many reports it was sent, how many await acknowledgement, how many it is working on now, the median time to acknowledge and from acknowledgement to resolution (with the 95th percentile once an agency has 20 timings), and how many it resolved or returned out of scope. Below the table, the same two clocks per agency and report category, as two grids. Exports CSV and prints or saves a PDF through the browser. |
| **Verification quality** (`/city/verification`) | Live, read-only. The thesis's cross-barangay verification quality view: per barangay over the last 30 days, the Tier 1 promotions made, how many were later revoked, how many officials made them, a day-by-day trend, and, of the reports by verified residents that agencies closed in the period, the share closed as false. A barangay whose share is above the city's on at least five closed reports is marked. Counts only: no official or resident is named. Exports CSV and prints or saves a PDF through the browser. |
| **Agencies** (`/city/agencies`) | Live, read-only. Every agency configured in the system, with its code and tier, and the report categories routing sends to it, lead categories marked. Adding agencies or changing where a category goes is not done here. |
| **Access log** (`/city/access-log`) | Live, read-only, for the municipal administrator. Every recorded event on reports across the city (openings, decisions, routings and agency progress), newest first, with the official who acted named alongside their role and office, filterable by kind of event and by a range of dates. Residents are never named, an event the database wrote by itself is shown as automatic, and no raw account identifier appears. Opening the page is itself recorded, and if that record can't be written the page shows nothing. The events shown can be exported as CSV or printed (saved as a PDF), the thesis's RA 10173 Data Access Log for data-protection requests; each export is recorded in the trail first and doesn't happen otherwise. Exports then appear in the log themselves, under their own filter, each with what was exported and how many rows; an opening of the log says which view was opened. |
| **City settings** (`/city/settings`) | Live. The city account's own display name, which the access log shows beside what it opened, with its email read-only, the day its two-step sign-in was set up, and the console's language, kept in the browser as on the barangay side. Two sound alerts for the city dashboard, also kept on the device and on by default: a chime when any barangay receives a new emergency, and one when a report anywhere in the city is scored Critical; they play on any city page that is open, with a test-sound button. The barangay queue's own alert switches are not here. |
| **Audit Log** | Live. The barangay's own access trail: every report opening, validation, rejection and routing on its reports, newest first, filterable by kind, by date (today, the last 7 days), and by the reports' categories, several at once. Read access comes through a database function that returns only the safe columns, not a table policy, so no official is named and the reporter is never in it — each row shows the time, the action, the role that did it, and the report. It loads the newest 500 events and says so. The events shown can be exported as CSV, the thesis's export of the log for data-protection requests; that export is itself recorded in the trail first. |

All report data on the barangay pages is scoped to the signed-in official's own
barangay by Row Level Security in the database. The application does not, and cannot,
widen that scope. The city dashboard reads city-wide, as its role is permitted to.

## Privacy

Officials never see a reporter's name, whether or not the resident chose to withhold
their identity. The interface shows only "Verified reporter" or "Verified reporter,
identity withheld", the thesis's wording.
This is deliberate — the system exposes no reporter-name field to officials at all —
and it applies to every page, the CSV export included.

Access is logged as well as restricted. Opening a report's detail drawer calls the
backend's `log_report_view` function, which records the official, the report, and the
resident whose data was viewed. The console never supplies the resident's identity to
that call; the backend resolves it from the report. Validations, rejections and routings
are logged through the backend functions that perform them. If a view can't be logged,
the console says so on screen rather than failing silently.

The city dashboard follows the same rule. Its role can read reporter identity in the
database, so the dashboard's queries never select the reporter's account, and no page
names a reporter. One view differs in what it reads, not in what it shows: to count
which closed reports came from verified residents, verification quality matches the
resident ids on the trust records against the resident ids on the attestations. It
reads no name or phone number with them, and only counts per barangay leave the server. Its counts carry no personal data, so viewing them writes no access
record; opening a report in the city report list is logged like any other opening.
The one page that names officials is the city access log, the oversight view of the
trail: it shows who opened, decided and routed each report, never whom a report
concerns, and never a resident. Opening it is recorded too, and it shows nothing if that
record can't be written. The city map and the barangay report drawer are the
only places that read a report's location, and only for reports whose resident neither
withheld their identity nor asked for discreet reporting; for those, the location is never
read at all, and on the city map the report is only counted under its barangay.

Verify Resident names residents (as Sanctions does, below), because an official
cannot attest that a person lives in the barangay without knowing who the person is. It
is open to the two administrator roles only, and it reads a resident's name, the last
four digits of their phone number (the full number never reaches the browser), their
registration date and their attestations. It reads nothing a resident reported, so no
report can be tied to a name through it. A search is sent in the body of a request and
never as part of the page's address, so a resident's name or number is not left in the
browser's history or in the web host's request log. The database's own API log does
record the query a search becomes, and the backend team can read that log. What is
recorded for an attestation is who attested, how and when; no ID number, ID image or
biometric is stored anywhere. The page does put each resident's account id in the
admin's browser beside the name, because the write needs it; the queue's live updates
carry the same id on each report (see Known limitations), so the two could be joined
outside the screen until the backend change already asked for is made.

Sanctions names residents for the same reason: an appeal is heard from a person. What it
keeps to itself is the report behind each strike. The thesis's panel shows that report
and the agency's reason for closing it as false; the console reads neither, because
either one beside a name would say who filed the report, which no other screen does and
which a resident who withheld their identity was promised would not happen. For the same
reason a strike is dated by its day, a cooldown is shown by the day it ends rather than the
moment, and the entries for a resident's valid reports are not read. At pilot
volume this narrows the link without closing it: a strike's day can still be set beside
the reports an agency closed as false that day.

Exports are recorded as well. A file or a print that names people, or that is the trail
itself, is written to the access trail before it is made: the Validation History CSV and
print, the Audit Log CSV, the weekly verification report's CSV and print, and the city
access log's CSV and print. The record says who
started an export of what, and of how many rows; if it can't be written, nothing is downloaded or
printed. Exports of counts alone (the Reports page's other two reports, the city
overview, the agency response times and verification quality) carry no personal data and
write no record. The record cannot follow a
file once it exists, and printing through the browser's own menu instead of the
console's button bypasses it.

What the log does not cover yet: the queue list itself shows each report's category and
the opening line of its description before any view is logged, and viewing the city map
writes no record, though each dot is where a resident was when they reported. Opening the Verify Resident list or
the Sanctions list writes no access record either; each attestation, revocation and lift
is recorded by the backend function that performs it. All of these are recorded as open
questions for the backend and data-protection review.

One limit is structural: the console records an opening, but the database does not
require one. An official's own session can read the same reports through the database's
API, which row-level security allows and nothing logs. A complete trail needs the backend
to serve report details only through a function that records the read as it returns it.

## Folder structure

```
src/
  app/
    login/                    Email, then emailed-code sign-in
    auth/callback/            Magic-link fallback handler
    not-authorized/
    actions/                  Server Actions: report review, resident verification, sanction lifts, two-step sign-in, profile update, sign-out
    queue/
    cluster-explorer/
    validation-history/
    audit-log/
    reports/
    verify-resident/          Tier 1 verification (barangay admins)
    sanctions/                Active cooldowns and suspensions, and lifts (barangay admins)
    settings/
    city/                     City dashboard (municipal_admin), read-only
      two-step/               The second sign-in step, and its set-up
      response-times/
      verification/
      page.tsx                Server component: auth gate + data fetch
      <Name>Client.tsx        Client component: the page UI
  components/
    layout/                   Sidebar, TopBar, AppShell, ProfileMenu
    ui/                       Badge, Button, Tile, ReporterChip, Toast, modals
    queue/                    Queue-specific components
    cluster-explorer/
    validation-history/
    audit-log/
    reports/
    verify-resident/
    sanctions/
    settings/
    city/
  lib/
    auth.ts                   requireBarangayOfficial(), requireBarangayAdmin() and requireCityAdmin() — the per-page gates
    supabase/                 Server and browser Supabase clients
    data/                     Server-only data access, one module per live page
    utils.ts
  types/                      Shared TypeScript interfaces
```

Each gated route is a pair: a server `page.tsx` that verifies the session and fetches
data, and a client component that renders it. Data access lives in `src/lib/data/`
and is marked `server-only`.

## Known limitations

These are gaps in the data available to the console, not unfinished interface work.
In each case the console shows nothing rather than an approximation.

- **The Audit Log shows roles, not officials, and the newest 500 events.** The read
  function deliberately withholds who acted and whom the report concerned, so the page
  cannot name an official; its filters narrow the events already loaded rather than the
  whole trail, and the page says so.
- **A page visited in the last three minutes is shown again at once, from the browser.**
  That is what keeps moving between pages free of loading screens. The queue brings
  itself up to date as soon as it is back on screen, and every decision clears the
  stored pages, but on the other pages a change made meanwhile (an agency's progress
  in Validation History, a new opening in the Audit Log) appears on the next visit
  after those three minutes, or on a reload.
- **Access-log coverage is incomplete.** See the Privacy section: list rows are not
  individually logged, live updates deliver full report rows to the
  browser because Supabase cannot filter that feed by column, and a read made outside
  the console, directly through the database's API, is not logged at all.
- **Only the city access log names who opened a report.** The barangay Audit Log's
  read function returns no actor identity, so a desk sees that a report was opened by a
  role, never by whom; the municipal administrator's access log names the official.
  There is no who-viewed-this panel on a report itself.
- **The city access log shows the newest 200 events of the chosen kind and dates.** Names
  and offices are read from each official's profile as it is now; the role shown is the
  one recorded with the event. Its export holds the events shown, so a longer period is
  exported in parts, by narrowing the dates. The barangay Audit Log's export likewise
  holds the events shown, out of the newest 500, and names no official.
- **Verify Resident lists residents, not requests.** The thesis's page is a queue of
  residents who asked for Tier 1 verification, each confirmed by scanning a QR code
  from the resident's phone. No request is recorded anywhere, so the page lists the
  barangay's residents by tier, with a search by name or phone number (the first 100
  by name), and the official finds the person in front of them. A profile can carry no
  name, and such a resident is found by their number. There is no QR step and no photo
  cross-check. A revoked resident can be verified again; the earlier revocation and its
  reason stay on the row.
- **Sanctions shows no cause report.** The thesis's detail panel names the report that
  triggered a strike and the agency's reason; the console shows the strike's track, its
  day and its effect on the trust score, and nothing that points at a report (see
  Privacy). An official hears what the appeal is about from the resident. Sanctions are
  applied by the backend when an agency closes a report as confirmed false; the console
  only lists and lifts them, and cannot apply one.
- **Cluster data.** The console shows which reports the duplicate-detection service
  grouped, not why: no centroid, radius, or per-report proximity signal is shown.
  The spatial panel plots each member's real position where one exists — not a
  computed shape for the cluster — and names how many members have no usable one
  (identity-withheld, discreet reporting, or no GPS fix) rather than guessing at
  their location. Only reports from the same barangay filed within 72 hours of each
  other are compared, and only pending reports are grouped, so a group thins out as
  its members are decided. Reports sent without a location, every identity-withheld
  report included, are left out of grouping. Grouping by photo similarity is not
  computed.
- **Priority comes from the inference service.** A report it has not scored is labelled
  Not scored rather than given a tier, and pending reports are listed highest score
  first, then longest-waiting first, with unscored reports after scored ones. Because
  the model rates nearly every emergency Critical, each row shows its score beside the
  tier; the ranking is carried by the score, not by the colour.
- **Routing from the console is manual and one-way.** An official routes a validated
  report to the agencies they tick. The category-to-agency mapping only marks agencies as
  Recommended; nothing is ticked in advance, so an agency off duty can be left out.
  Routing cannot be undone from the console. The backend's own routings don't use this
  list: the Critical escalation timer below sends a report to all its mapped agencies.
  With CDRRMO dispatch switched on, the list applies to emergencies too (owner decision
  Q4): Validate opens it, and the database routes the agencies ticked as it validates,
  the first one leading, and always adds CDRRMO, as a supporting agency unless ticked.
  With nothing ticked, which the console sends for a recalled report or when the agency
  list could not be loaded, the database adds CDRRMO alone, which can pass it on. An
  emergency already with its
  agencies when the barangay validates it gets no list. An official also chooses the
  agencies for a report that every agency
  closed as out of scope: the database returns it to the barangay as validated, and the
  official picks other agencies for it from a list that leaves out the ones that sent it
  back. The
  backend's Critical escalation timer is switched on: a Critical emergency the desk
  leaves untouched is routed to its mapped agencies when its timer (2 to 10 minutes,
  shorter for a higher score) ends. A report it routes appears under Routed to agencies
  marked Auto-routed, and one that every agency sends back returns to the Emergency tab,
  marked as returned by the agencies, for a review before another agency is chosen. The
  Emergency tab lists every report routed without a review here (a responder's report,
  or one the timer sent) above the queue, with the recall window's countdown and a
  Recall button while it is open (Critical 5 minutes, High 15, a responder's report 15
  for any class below Critical); after the window, or once an agency has sent a unit,
  Record recall in the drawer only records the attempt. A recalled report returns to the
  Emergency tab as pending. With CDRRMO dispatch on, Validate opens the agency list: the
  report goes back to the agencies it was recalled from, its old lead still leading,
  plus any others ticked (none are needed) and CDRRMO. With dispatch off, once validated
  it shows as Routing incomplete, its agencies marked recalled, and Finish routing sends
  it back to them (the backend reopens their rows); choosing other agencies for it is
  not built there. Its other automatic routing (for high-confidence
  emergencies) stays switched off.
- **Rejection categories are stored inside the reason text.** The database has one
  free-text reason per decision and no category column, so the category is saved as a
  short prefix (for example `[duplicate]`) that the console reads back. Rejections made
  before categories existed, or by another dashboard sharing the database, appear
  without a category.
- **Manual report intake** is not offered. Reports are attributable to a resident
  account by design, so intake on a walk-in resident's behalf requires a decision on
  attribution before it can be built.
- **The report chat** has two threads per report. Group is read by the resident and by
  every agency the report is routed to; an agency routed after the conversation started
  reads all of it, including messages the desk wrote before any agency was involved.
  Agencies see it only once the resident has accepted the updated consent notice.
  Desk is staff only and appears once the report has been routed. Chat is not offered on
  a discreet report, becomes read-only three days after the report closes, and a thread
  that cannot be loaded says so rather than showing an empty one. Photos and videos in
  chat are not available yet. Messages are stored by the backend, and sending one writes
  an audit_logs row (report_message_sent on Group, report_desk_message_sent on Desk)
  recording who sent it on which report; the message text itself stays in the chat.
- **Cluster splitting and merging** are not offered. Barangay roles cannot write
  cluster assignments, and a manual split would be undone by the next detection pass.
- **Report addresses.** Reports carry a geographic point, not an address string, so the
  drawer shows the point on a street map with its coordinates, not a street address. The
  map's tiles come from OpenStreetMap's public tile server, which therefore sees the area
  of each report opened, and, for Cluster Explorer, of each cluster selected — the same
  identity-withheld and discreet-reporting reports that are hidden from the drawer's map
  are also never placed on the cluster map.
- **Validation History** shows the 50 most recent reviewed reports. Filters apply to
  those rows.
- **Resolving at the barangay is an addition to the thesis**, whose Chapter 3 gives the
  desk only validate, route and reject. It covers Other-reports that no agency has held;
  a report an agency holds, or that agencies returned, keeps its routing actions. The
  official's note is kept for the barangay desk and city oversight and is not shown to
  the resident. A report resolved this way leaves the queue and is found in Validation
  History; the CSV export does not carry the note.
- **Reports export CSV and print to PDF, not PNG.** The thesis also describes a PNG export
  of the Daily Queue Summary, which is not built; the browser's print dialog saves a PDF.
- **Preferences are per device.** Language and alert settings live in the browser, not
  in the account, because no profile column exists for them and browser-notification
  permission is granted per browser anyway. Alerts fire only while the Queue page is
  open; there is no push to a closed console.
- **The Tagalog interface covers the console's own text, not everything on screen.**
  Menus, buttons, tabs, dialogs, notices, and empty states switch language. Report
  text is never translated — it is shown exactly as the resident wrote it. Values the
  server formats (report categories, priority levels, relative times like "5m ago",
  review timestamps) and error messages returned by the server stay in English, as do
  the sign-in and error pages and the CSV export. The Tagalog wording was reviewed by the
  team on 2026-09-29. A page loads in the role's default
  language and switches to a different saved choice a moment later.
- **The alert sound needs one click on the queue page.** Browsers block sound on a page
  nobody has clicked, and the chime is triggered by an arriving report, not a click. After
  loading or refreshing the queue, the footer asks for one click until it has had one.
  Settings has a test-sound button.
- **The city dashboard covers four of the thesis's six city views.** The city-wide
  overview, the incident map, per-agency response time and cross-barangay verification
  quality are built, plus a city-wide report list, a read-only agency list and an access
  log. Not built: the false-route rate (defined over automatically routed reports),
  recalibration controls, agency management (adding, elevating or editing agencies), and
  identity reveal.
  Response times are measured from when the report was routed, by a barangay or by the
  Critical escalation timer.
- **Verification figures count what the system records.** The thesis's contestation
  rate is shown as revocations, on the barangay's report #13 and on the city's
  verification quality view: a senior barangay admin revoking an attestation is the only
  record there is of one being contested. The false-report share counts reports an
  agency closed, by what the closure did to the reporter's trust record, for residents
  verified when the agency closed the report; a report still open is in neither number. Until residents are
  verified in numbers, both views are mostly zeros.
- **Two-step sign-in is the city dashboard's, and the console's own check.** A city
  session that skips the step gets no city page, but the same session could still read or change data
  through the database's API, or the console's own action endpoints, until the backend also requires the step there, which is
  planned once city accounts have set it up. Barangay accounts have no second step,
  where the thesis recommends one. The console cannot reset an account's
  authenticator; that is done in Supabase.
- **Live updates need a websocket.** On a network that blocks them, the queue says so
  in its footer and falls back to a 30-second refresh.
- **The city dashboard's sound alerts** need the page open and a click or key press on
  it since it was opened (a browser rule for sound), so the first alert after a reload
  can be silent. There is no fallback when the live connection is blocked: the alerts
  simply don't sound. Live updates deliver each changed report's full row to the
  browser; the alert reads only its id, intake tier and priority, and shows
  nothing on screen.
- **The city map is a snapshot of phone positions.** It loads when opened and doesn't
  update live, unlike the queue. Each dot is where the reporter's phone was, which may not
  be where the incident is. The street map comes from OpenStreetMap's public tile
  server, which therefore sees which part of the city is being viewed.

## Notes on fidelity to the thesis mockups

- Colors, badges, and layout are derived from Figures 23, 24, 48, 49, and 50 and their
  accompanying descriptions in Chapter 3 and Appendix A.
- Bilingual EN/Tagalog microcopy (e.g. "Mga aksyon · pag-verify, pag-recall, at
  pag-merge") is reproduced where the thesis text specifies it.
- The "Recall window" queue tab from the mockups is a strip at the top of the Emergency
  tab instead of a fifth tab: it lists the reports routed without a review here, with
  the recall countdown and the Recall button.
- Where a mockup element had no backing data (trust-score deltas, median resolution
  time, MFA status), it was either removed or relabelled to what is actually measured.
  The queue's "Median wait" tile, for example, is the median age of pending reports.
