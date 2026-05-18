// Map category names (from API) to the design palette key.
// API stores category objects with name + optional color, but the redesign uses
// a fixed 10-hue palette. We do best-effort matching on the name.

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

export function categoryColor(category) {
  if (!category) return CATEGORY_PALETTE.transfer;
  if (category.color && /^#?[0-9a-fA-F]{3,8}$/.test(String(category.color).replace('#', ''))) {
    return category.color.startsWith('#') ? category.color : `#${category.color}`;
  }
  return CATEGORY_PALETTE[categoryKeyForName(category.name)] || CATEGORY_PALETTE.transfer;
}

export function categoryKey(category) {
  if (!category) return 'transfer';
  return categoryKeyForName(category.name);
}

// Friend tint — deterministic from id
const FRIEND_TINTS = [
  '#FF8B6B', '#7DB9FF', '#B79CFF', '#FFB454', '#6EE7B7',
  '#FF7AB6', '#FFD66E', '#6EE7E7', '#D7FF3D', '#FF7A7A',
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
