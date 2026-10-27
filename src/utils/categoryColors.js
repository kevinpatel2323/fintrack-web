// Category colours. The API stores a category's colour as a hex string (what
// the colour picker writes); rendering goes through Espresso tokens wherever
// the stored value is one of our palette colours, so it follows light/dark.

// Authoring palette — written to the database by the category colour picker,
// so it must stay literal hex. One Espresso colour family per key (the light
// theme's ink-*-5 step).
export const CATEGORY_PALETTE = {
  food:      '#E86C13', // orange
  transport: '#0C8EF8', // blue
  shopping:  '#7757EE', // violet
  bills:     '#DF9310', // amber
  grocery:   '#43AC79', // green
  rent:      '#E34AA6', // pink
  entmt:     '#9C45E3', // purple
  transfer:  '#7C7C7C', // gray
  salary:    '#35BAAD', // teal
  health:    '#3BBDE5', // cyan
  red:       '#E03434',
  yellow:    '#EDBA14',
};

// Rendering palette — theme-aware, resolved per theme by styles/theme.css.
export const CATEGORY_TOKENS = {
  food:      'var(--cat-food)',
  transport: 'var(--cat-transport)',
  shopping:  'var(--cat-shopping)',
  bills:     'var(--cat-bills)',
  grocery:   'var(--cat-grocery)',
  rent:      'var(--cat-rent)',
  entmt:     'var(--cat-entmt)',
  transfer:  'var(--cat-transfer)',
  salary:    'var(--cat-salary)',
  health:    'var(--cat-health)',
  red:       'var(--ink-red-5)',
  yellow:    'var(--ink-yellow-5)',
};

// Colours earlier pickers wrote. Categories saved back then still carry them;
// they render as the nearest token instead of the old hex. '#E74C3C' is not
// here on purpose: it was the first picker's pre-selected default, so most
// categories have it without anyone choosing red — it reads as "no colour".
const LEGACY_DEFAULT = '#E74C3C';
const LEGACY_PALETTE = {
  // First picker (flat UI)
  '#E67E22': 'food',
  '#F07C4A': 'food',
  '#F1C40F': 'yellow',
  '#2ECC71': 'grocery',
  '#1ABC9C': 'salary',
  '#3498DB': 'transport',
  '#9B59B6': 'entmt',
  '#E91E63': 'rent',
  '#00BCD4': 'health',
  '#795548': 'bills',
  '#607D8B': 'transfer',
  // Second picker (neon)
  '#FF8B6B': 'food',
  '#7DB9FF': 'transport',
  '#B79CFF': 'shopping',
  '#FFB454': 'bills',
  '#6EE7B7': 'grocery',
  '#FF7AB6': 'rent',
  '#FFD66E': 'entmt',
  '#8D9099': 'transfer',
  '#D7FF3D': 'salary',
  '#6EE7E7': 'health',
};

const TOKEN_FOR_HEX = Object.fromEntries([
  ...Object.entries(CATEGORY_PALETTE).map(([key, hex]) => [hex, CATEGORY_TOKENS[key]]),
  ...Object.entries(LEGACY_PALETTE).map(([hex, key]) => [hex, CATEGORY_TOKENS[key]]),
]);

const NAME_RULES = [
  [/^food|restaurant|dining|cafe|coffee|swiggy|zomato/i, 'food'],
  [/transport|uber|ola|fuel|petrol|metro|train|cab|taxi/i, 'transport'],
  [/shop|shopping|amazon|flipkart|myntra|apparel|clothing|cloth/i, 'shopping'],
  [/bill|electric|recharge|broadband|internet|water|gas|util/i, 'bills'],
  [/grocer|bigbasket|blinkit|zepto|instamart|vegetable/i, 'grocery'],
  [/rent|mortgage|housing|emi.*home|home loan/i, 'rent'],
  [/entertainment|movie|netflix|spotify|prime|cinema|game/i, 'entmt'],
  [/transfer|imps|neft|withdraw/i, 'transfer'],
  [/salary|income|pay\s?roll|stipend|wages/i, 'salary'],
  [/health|hospital|medic|pharma|doctor|clinic|fitness|gym/i, 'health'],
];

export function categoryKeyForName(name) {
  if (!name) return 'transfer';
  for (const [re, key] of NAME_RULES) {
    if (re.test(name)) return key;
  }
  return 'transfer';
}

// Hues for categories with no colour of their own, picked from the name so a
// category keeps its colour everywhere. Gray stays reserved for transfers and
// red for things that need attention.
const NAME_HUES = ['food', 'transport', 'shopping', 'bills', 'grocery', 'rent', 'entmt', 'salary', 'health', 'yellow'];

function hueForName(name) {
  const key = categoryKeyForName(name);
  if (key !== 'transfer' || /transfer|imps|neft|withdraw/i.test(name || '')) return CATEGORY_TOKENS[key];
  // FNV-1a: spreads short, similar names ("Stocks Groww", "Stocks Zerodha")
  // across hues far better than a plain multiply-add hash.
  let h = 0x811c9dc5;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return CATEGORY_TOKENS[NAME_HUES[h % NAME_HUES.length]];
}

// A category's display colour: the theme token for a palette colour (current
// or legacy), the stored hex for a custom one, else a hue from its name.
export function categoryColor(category) {
  if (!category) return CATEGORY_TOKENS.transfer;
  const raw = category.color ? String(category.color).trim() : '';
  if (/^#?[0-9a-fA-F]{3,8}$/.test(raw)) {
    const hex = (raw.startsWith('#') ? raw : `#${raw}`).toUpperCase();
    if (hex !== LEGACY_DEFAULT) return TOKEN_FOR_HEX[hex] || hex;
  }
  return hueForName(category.name);
}

export function categoryKey(category) {
  if (!category) return 'transfer';
  return categoryKeyForName(category.name);
}

// Friend tint — deterministic from id. Theme tokens, not literals, so anything
// tinted per person re-tints with the theme.
const FRIEND_TINTS = [
  'var(--cat-food)', 'var(--cat-transport)', 'var(--cat-shopping)',
  'var(--cat-bills)', 'var(--cat-grocery)', 'var(--cat-rent)',
  'var(--cat-entmt)', 'var(--cat-health)', 'var(--cat-salary)',
  'var(--ink-red-5)',
];

export function friendTint(idOrName) {
  if (!idOrName) return FRIEND_TINTS[0];
  let h = 0;
  const s = String(idOrName);
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return FRIEND_TINTS[h % FRIEND_TINTS.length];
}

export function initialsOf(name) {
  if (!name) return '··';
  // Initials come from words that start with a letter, ignoring anything in
  // brackets: "Het Patel (Sankalp)" → HP, "IPL 2026" → IP — not "H(" / "I2".
  const words = String(name).replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean);
  const lettered = words.filter((w) => /^\p{L}/u.test(w));
  const parts = lettered.length > 0 ? lettered : words;
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
