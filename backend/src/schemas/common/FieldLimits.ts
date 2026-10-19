// The certificate prints the name on one line and the title on up to two of a
// fixed A4 layout; these limits are what that layout is sized for. Records
// saved before the limits existed may be longer, and the renderer truncates them.
export const FULL_NAME_MAX_LENGTH = 120;
export const ACTIVITY_TITLE_MAX_LENGTH = 150;
