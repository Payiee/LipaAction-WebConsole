import {
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Inbox,
  Layers,
  Lock,
  Map as MapGlyph,
  Maximize2,
  Menu,
  Minimize2,
  Paperclip,
  PhoneOff,
  Play,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  User,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/lib/utils";

export type IconName =
  | "search"
  | "menu"
  | "close"
  | "check"
  | "lock"
  | "queue"
  | "clusters"
  | "history"
  | "reports"
  | "audit"
  | "settings"
  | "no-contact"
  | "agencies"
  | "timer"
  | "map"
  | "verify"
  | "sanctions"
  | "expand"
  | "shrink"
  | "person"
  | "attach"
  | "play"
  | "previous"
  | "next"
  | "chevron-down";

/**
 * The console's icons, from Lucide (lucide-react, ISC licence).
 *
 * Components ask for an icon by name, never by importing from lucide-react
 * directly, so the set stays small and swappable in this one file. Always
 * decorative: the control or text next to an icon carries the meaning, so it
 * is hidden from screen readers. Size it with a className (h-4 w-4 default).
 */
const ICONS: Record<IconName, LucideIcon> = {
  search: Search,
  menu: Menu,
  close: X,
  check: Check,
  lock: Lock,
  queue: Inbox, // the reports waiting for a decision
  clusters: Layers, // reports grouped as one incident
  history: ClipboardCheck, // decisions already made
  reports: BarChart3,
  audit: FileText, // the written trail
  settings: SlidersHorizontal,
  "no-contact": PhoneOff, // a discreet report: don't call or text the reporter
  agencies: Building2, // the responder offices
  timer: Timer, // how long agencies take
  map: MapGlyph, // where open reports are
  verify: UserCheck, // attesting that a resident lives in the barangay
  sanctions: ShieldAlert, // cooldowns and suspensions on residents' accounts
  expand: Maximize2, // open a map at full size
  shrink: Minimize2, // back to the small map
  person: User, // the reporter's avatar in the chat: an icon, never initials
  attach: Paperclip, // add a photo or video to a chat message
  play: Play, // a chat video, not yet playing
  previous: ChevronLeft, // the previous photo in the chat viewer
  next: ChevronRight, // the next one
  "chevron-down": ChevronDown, // a button that opens a list
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" focusable="false" strokeWidth={2} className={cx("h-4 w-4 shrink-0", className)} />;
}
