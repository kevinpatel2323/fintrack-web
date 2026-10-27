// Single source of truth for the app's layout tiers.
//
//   compact   < 768px      phone shell + bottom tab bar
//   medium    768–1100px   desktop shell, sidebar starts as a 48px icon rail
//   expanded  > 1100px     desktop shell, full 240px sidebar
//
// 768 is the boundary because that is the narrowest tablet in portrait: below
// it the sidebar shell has no room to pay for itself. The shell itself is
// components/shell/AppShell.jsx; CSS that branches on width uses 767.98px.
//
// Widths only. Height and pointer type are handled in CSS so that a phone held
// in landscape adapts without the shell swapping out from under React.

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
