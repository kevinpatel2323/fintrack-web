// Map category names (from API) to the design palette key.
// API stores category objects with name + optional color, but the redesign uses
// a fixed 10-hue palette. We do best-effort matching on the name.

// Authoring palette. These hex values are what the category colour-picker
// writes to the database, so they must stay literal — a var() reference would
// be persisted verbatim. Rendering goes through CATEGORY_TOKENS below instead.
export const CATEGORY_PALETTE = {
  food:      '#FF8B6B',
  transport: '#7DB9FF',
  shopping:  '#B79CFF',
  bills:     '#FFB454',
  grocery:   '#6EE7B7',
  rent:      '#FF7AB6',
  entmt:     '#FFD66E',
  transfer:  '#8D9099',
  salary:    '#D7FF3D',
  health:    '#6EE7E7',
};

// Rendering palette — theme-aware. Same ten hues, resolved per theme by
// tokens.css (see --ft-cat-*), so charts and chips follow light/dark.
export const CATEGORY_TOKENS = {
  food:      'var(--ft-cat-food)',
  transport: 'var(--ft-cat-transport)',
  shopping:  'var(--ft-cat-shopping)',
  bills:     'var(--ft-cat-bills)',
  grocery:   'var(--ft-cat-grocery)',
  rent:      'var(--ft-cat-rent)',
  entmt:     'var(--ft-cat-entmt)',
  transfer:  'var(--ft-cat-transfer)',
  salary:    'var(--ft-cat-salary)',
  health:    'var(--ft-cat-health)',
};

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

// Returns a user-set hex when the category has one, otherwise a theme token.
// User-set colours come from the database and cannot be themed — see the
// unresolved-items note in the light-theme migration.
export function categoryColor(category) {
  if (!category) return CATEGORY_TOKENS.transfer;
  if (category.color && /^#?[0-9a-fA-F]{3,8}$/.test(String(category.color).replace('#', ''))) {
    return category.color.startsWith('#') ? category.color : `#${category.color}`;
  }
  return CATEGORY_TOKENS[categoryKeyForName(category.name)] || CATEGORY_TOKENS.transfer;
}

export function categoryKey(category) {
  if (!category) return 'transfer';
  return categoryKeyForName(category.name);
}

// Friend tint — deterministic from id. Theme tokens, not literals, so avatars
// re-tint with the theme.
const FRIEND_TINTS = [
  'var(--ft-cat-food)', 'var(--ft-cat-transport)', 'var(--ft-cat-shopping)',
  'var(--ft-cat-bills)', 'var(--ft-cat-grocery)', 'var(--ft-cat-rent)',
  'var(--ft-cat-entmt)', 'var(--ft-cat-health)', 'var(--ft-cat-salary)',
  'var(--ft-spend)',
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
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
