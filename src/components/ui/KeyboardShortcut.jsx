import { Fragment, forwardRef } from 'react';
import {
  ArrowBigRightDash,
  ArrowBigUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Command,
  CornerDownLeft,
  Delete,
  Option,
} from 'lucide-react';
import './KeyboardShortcut.css';

// Port of frappe-ui KeyboardShortcut.vue (display half of
// utils/keyboardShortcutCombo.ts).
//
//   combo      'Mod+Shift+K' — modifiers Mod/Ctrl/Alt/Shift, then one key.
//              Mod is ⌘ on Apple platforms, Ctrl elsewhere.
//   bg         chip style (one <kbd> per key) instead of plain muted text
//   showPlus   'auto' (default): '+' only between two text keys ("Ctrl+K",
//              but "⌘K"); true/false force it. Plain mode only.
//   altCombos  equivalent combos shown after a '/'
//   useIcons   draw arrows, Enter, Backspace, Delete as icons (default true)
//   children   fallback when there is no combo
//
// Display only: binding the shortcut is the caller's job.

const cx = (...parts) => parts.filter(Boolean).join(' ');

const MODIFIERS = ['mod', 'ctrl', 'alt', 'shift'];

const KEY_DISPLAY = {
  escape: 'Esc',
  enter: '↵',
  space: 'Space',
  tab: 'Tab',
  insert: 'Insert',
  backspace: '⌫',
  delete: '⌦',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  home: 'Home',
  end: 'End',
  digit0: '0',
  digit1: '1',
  digit2: '2',
  digit3: '3',
  digit4: '4',
  digit5: '5',
  digit6: '6',
  digit7: '7',
  digit8: '8',
  digit9: '9',
  plus: '+',
  minus: '-',
  equal: '=',
  slash: '/',
  backslash: '\\',
  backtick: '`',
  comma: ',',
  period: '.',
  semicolon: ';',
  quote: "'",
  bracketleft: '[',
  bracketright: ']',
};

const WORD_BY_DISPLAY = {
  '⌘': 'Command',
  Esc: 'Escape',
  PgUp: 'Page Up',
  PgDn: 'Page Down',
  Shift: 'Shift',
  '⌥': 'Option',
  Alt: 'Alt',
  Ctrl: 'Control',
  '↵': 'Enter',
  '⌫': 'Backspace',
  '⌦': 'Delete',
  '↑': 'Up Arrow',
  '↓': 'Down Arrow',
  '←': 'Left Arrow',
  '→': 'Right Arrow',
  '+': 'Plus',
  '-': 'Minus',
  '=': 'Equal',
  '/': 'Slash',
  '\\': 'Backslash',
  '`': 'Backtick',
  ',': 'Comma',
  '.': 'Period',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'Bracket Left',
  ']': 'Bracket Right',
};

const KEY_ICONS = {
  '↑': ArrowUp,
  '↓': ArrowDown,
  '←': ArrowLeft,
  '→': ArrowRight,
  '↵': CornerDownLeft,
  '⌫': Delete,
  '⌦': ArrowBigRightDash,
};

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  if (/Mac|iPod|iPhone|iPad/i.test(platform)) return true;
  return /Mac OS X|Macintosh|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function parsePart(original, isMac) {
  const lower = original.toLowerCase();
  if (MODIFIERS.includes(lower)) {
    if (lower === 'shift') return { raw: original, type: 'shift', display: 'Shift' };
    if (lower === 'alt') return { raw: original, type: 'alt', display: isMac ? '⌥' : 'Alt' };
    if (lower === 'ctrl' || !isMac) return { raw: original, type: 'ctrl', display: 'Ctrl' };
    return { raw: original, type: 'cmd', display: '⌘' };
  }
  if (has(KEY_DISPLAY, lower)) return { raw: original, type: 'key', display: KEY_DISPLAY[lower] };
  if (/^[a-z]$/.test(lower) || /^f([1-9]|1[0-2])$/.test(lower)) {
    return { raw: original, type: 'key', display: lower.toUpperCase() };
  }
  return { raw: original, type: 'key', display: original };
}

function parseCombo(raw, isMac) {
  if (!raw) return [];
  const parts = raw.split('+').map((p) => parsePart(p.trim(), isMac));
  // Mod and Ctrl are one modifier off macOS: draw it once.
  const seen = new Set();
  return parts.filter((part) => {
    if (part.type === 'key') return true;
    if (seen.has(part.type)) return false;
    seen.add(part.type);
    return true;
  });
}

const spellOut = (parts) => parts.map((p) => (has(WORD_BY_DISPLAY, p.display) ? WORD_BY_DISPLAY[p.display] : p.display)).join(' + ');

const KeyboardShortcut = forwardRef(function KeyboardShortcutImpl(
  { combo, bg = false, showPlus = 'auto', altCombos = [], useIcons = true, children, className, ...rest },
  ref,
) {
  const isMac = isMacPlatform();
  const parts = parseCombo(combo, isMac);

  const iconFor = (part) => {
    if (!useIcons || ['cmd', 'shift', 'alt'].includes(part.type)) return null;
    return KEY_ICONS[part.display] || null;
  };
  const bgIconFor = (part) => {
    if (part.type === 'cmd') return Command;
    if (!useIcons) return null;
    return KEY_ICONS[part.display] || null;
  };
  const drawsIcon = (part) => ['cmd', 'shift', 'alt'].includes(part.type) || iconFor(part) !== null;

  const plusAfter = parts
    .slice(0, -1)
    .map((part, i) => (showPlus === 'auto' ? !(drawsIcon(part) || drawsIcon(parts[i + 1])) : Boolean(showPlus)));

  const seenCombos = new Set([parts.map((p) => p.display).join('+')]);
  const uniqueAlts = (altCombos || []).filter((c) => {
    const key = parseCombo(c, isMac)
      .map((p) => p.display)
      .join('+');
    if (seenCombos.has(key)) return false;
    seenCombos.add(key);
    return true;
  });

  // A labelled role="img" replaces its subtree for assistive tech, so the
  // alternatives are named here too.
  const ariaLabel = parts.length
    ? `Shortcut ${[spellOut(parts), ...uniqueAlts.map((c) => spellOut(parseCombo(c, isMac)))].join(', or ')}`
    : undefined;

  const icon = (Icon) => <Icon className="ui-kbd__icon" size={12} strokeWidth={1.5} aria-hidden="true" />;

  let body;
  if (bg && parts.length) {
    body = parts.map((part, i) => {
      const Icon = bgIconFor(part);
      return (
        <kbd key={`${i}-${part.raw}`} className="ui-kbd__key" data-key-type={part.type}>
          {Icon ? icon(Icon) : part.display}
        </kbd>
      );
    });
  } else if (parts.length) {
    body = parts.map((part, i) => {
      let content;
      if (part.type === 'cmd') content = icon(Command);
      else if (part.type === 'shift') content = icon(ArrowBigUp);
      else if (part.type === 'alt') content = icon(Option);
      else {
        const Icon = iconFor(part);
        content = Icon ? icon(Icon) : <span className="ui-kbd__text">{part.display}</span>;
      }
      return (
        <Fragment key={`${i}-${part.raw}`}>
          <span className="ui-kbd__part" data-key-type={part.type}>
            {content}
          </span>
          {plusAfter[i] && (
            <span className="ui-kbd__plus" aria-hidden="true">
              +
            </span>
          )}
        </Fragment>
      );
    });
  } else {
    body = children;
  }

  return (
    <span
      ref={ref}
      className={cx('ui-kbd', !bg && 'ui-kbd--plain', className)}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      data-bg={bg ? 'true' : undefined}
      {...rest}
    >
      {body}
      {uniqueAlts.length > 0 && (
        <span className="ui-kbd__alts">
          {uniqueAlts.map((alt, i) => (
            <Fragment key={`alt-${i}-${alt}`}>
              <span className="ui-kbd__alt-sep" aria-hidden="true">
                /
              </span>
              <KeyboardShortcut combo={alt} bg={bg} showPlus={showPlus} useIcons={useIcons} />
            </Fragment>
          ))}
        </span>
      )}
    </span>
  );
});

export default KeyboardShortcut;
