// Pure layout rules for AvatarGroup, kept apart from React so they can be
// unit-tested in node.

const SIZE_PX = { xs: 16, sm: 20, md: 24, lg: 28, xl: 32 };
// Each avatar after the first tucks under its neighbour by this much: enough
// to read as a stack, little enough that both initials stay legible.
const OVERLAP_PX = { xs: 2, sm: 3, md: 4, lg: 5, xl: 6 };
const THEMES = ['blue', 'green', 'violet', 'amber', 'gray'];

/** Stable colour per person, so someone looks the same everywhere. */
export function avatarTheme(key) {
  let h = 0x811c9dc5;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return THEMES[h % THEMES.length];
}

/** How many avatars fit in `width` when there are `count` people. */
export function visibleCount(count, width, { size = 'md', max = 5 } = {}) {
  const s = SIZE_PX[size] ?? 24;
  const step = s - (OVERLAP_PX[size] ?? 4);
  const cap = Math.min(count, max);
  const span = (n) => (n <= 0 ? 0 : s + (n - 1) * step);
  if (!Number.isFinite(width) || width <= 0) return cap;
  if (count <= max && span(count) <= width) return count;
  // Leave a slot for the "+N" chip; always show at least one face.
  for (let n = cap; n >= 1; n -= 1) {
    if (n < count && span(n + 1) <= width) return n;
  }
  return 1;
}
