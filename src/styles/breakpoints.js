// Single source of truth for the app's layout tiers.
//
//   compact   < 768px      MobileShell + bottom tab bar
//   medium    768–1100px   DesktopShell, sidebar collapsed to an icon rail
//   expanded  > 1100px     DesktopShell, full 240px sidebar
//
// 768 is the boundary because that is the narrowest tablet in portrait: below
// it the sidebar shell has no room to pay for itself. The matching CSS lives in
// src/styles/app.css — keep the two in sync.
//
// Widths only. Height and pointer type are handled in CSS (see the
// `max-height` / `pointer: coarse` blocks in app.css) so that a phone held in
// landscape adapts without the shell swapping out from under React.

import { useMediaQuery } from '../hooks/useMediaQuery.js';

export const COMPACT_MAX = 767.98;
export const MEDIUM_MAX = 1100;

export const QUERY_COMPACT = `(max-width: ${COMPACT_MAX}px)`;
export const QUERY_MEDIUM_UP = `(min-width: ${COMPACT_MAX + 0.02}px)`;
export const QUERY_EXPANDED = `(min-width: ${MEDIUM_MAX + 1}px)`;

/** True on phone-width viewports, where pages render their compact layout. */
export function useIsCompact() {
  return useMediaQuery(QUERY_COMPACT);
}
