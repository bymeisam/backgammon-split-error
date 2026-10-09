import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers TokenModal.tsx, used by /sources/galaxy/matches (blocking, until a
// token is pasted) and the Galaxy card on /sources ("Add token").
export const style = {
  modalHeading: shared.modalHeading,
  modalSubtext: clsx(shared.modalText, "mt-1"),
  tabRow: "inline-flex w-fit gap-1 rounded-control bg-sunken p-[3px]",
  // Function, 1 param -> passed directly. A segmented control: the active
  // tab raised on the track.
  tabButton: (isActive: boolean): string =>
    clsx(
      "rounded-[7px] px-4 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
    ),
  // Shared by the curl-command label and the authorization label.
  fieldWrapper: "flex flex-col gap-2",
  fieldLabel: "text-sm font-medium text-ink-muted",
  // Shared by the curl textarea and the plain authorization input.
  textInput: clsx(shared.input, "p-3 font-mono text-xs"),
  errorBox: shared.errorBox,
  // Connect, plus Cancel when the modal can be dismissed (on /sources).
  buttons: "flex items-center gap-2",
  connectButton: clsx(shared.buttonPrimary, "h-10 px-6"),
  cancelButton: clsx(shared.buttonSecondary, "h-10 px-6"),
} as const;
