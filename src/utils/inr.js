const MINUS = '−';

export function inr(n, opts = {}) {
  const { sign = false, decimals = 0 } = opts;
  const num = Number(n);
  if (!Number.isFinite(num)) return '₹0';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  let prefix = '';
  if (sign) {
    prefix = num > 0 ? '+' : num < 0 ? MINUS : '';
  } else if (num < 0) {
    prefix = MINUS;
  }
  return `${prefix}₹${formatted}`;
}

export function inrCompact(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '₹0';
  const abs = Math.abs(num);
  let v, suf;
  if (abs >= 1e7) { v = abs / 1e7; suf = 'Cr'; }
  else if (abs >= 1e5) { v = abs / 1e5; suf = 'L'; }
  else if (abs >= 1e3) { v = abs / 1e3; suf = 'k'; }
  else { v = abs; suf = ''; }
  let display;
  if (v >= 100) display = String(Math.round(v));
  else if (v >= 10) display = v.toFixed(1).replace(/\.0$/, '');
  else display = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num < 0 ? MINUS : ''}₹${display}${suf}`;
}

export function num(n, opts = {}) {
  const { decimals = 0 } = opts;
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export const FT_MINUS = MINUS;
