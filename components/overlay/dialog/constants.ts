export const SLOT = {
  ROOT: "dialog",
  TRIGGER: "dialog-trigger",
  PORTAL: "dialog-portal",
  CLOSE: "dialog-close",
  OVERLAY: "dialog-overlay",
  CONTENT: "dialog-content",
  HEADER: "dialog-header",
  FOOTER: "dialog-footer",
  TITLE: "dialog-title",
  DESCRIPTION: "dialog-description",
} as const;

export const DEFAULT = {
  SHOW_CLOSE_BUTTON: true,
  FOOTER_SHOW_CLOSE_BUTTON: false,
  CLOSE_BUTTON_SR_TEXT: "Close",
} as const;
