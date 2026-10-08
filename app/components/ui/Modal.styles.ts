import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Modal.tsx. The look is the shared modal one.
export const style = {
  dialog: shared.modalDialog,
  panel: shared.modalPanel,
} as const;
