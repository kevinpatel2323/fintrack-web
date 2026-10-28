import { isValidElement } from 'react';

// Menu options shared by Dropdown (a floating menu) and ActionSheet (the
// same menu as a bottom sheet on phones).

// A group is any entry holding a list of items; its `group` label is optional
// (an unlabelled group is still separated from its neighbours by a hairline).
function isGroup(opt) {
  return !!opt && typeof opt === 'object' && (Array.isArray(opt.items) || Array.isArray(opt.options));
}

function isShown(item) {
  return !!item && !(typeof item.condition === 'function' && !item.condition());
}

export function normalizeOptions(options) {
  const groups = [];
  let implicit = null;
  (options || []).forEach((opt, i) => {
    if (!opt) return;
    if (isGroup(opt)) {
      implicit = null;
      const items = (opt.items || opt.options)
        .filter(isShown)
        .map((it) => (opt.theme && !it.theme ? { ...it, theme: opt.theme } : it));
      if (items.length) groups.push({ key: opt.key ?? `group-${i}`, label: opt.hideLabel ? undefined : opt.group, items });
      return;
    }
    if (!isShown(opt)) return;
    if (!implicit) {
      implicit = { key: `implicit-${i}`, label: undefined, items: [] };
      groups.push(implicit);
    }
    implicit.items.push(opt);
  });
  return groups;
}

export function renderIcon(icon, className, size = 16) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon className={className} size={size} aria-hidden="true" />;
}

