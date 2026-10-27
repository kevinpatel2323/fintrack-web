import { forwardRef, useEffect, useState } from 'react';
import { initialsOf } from '../../utils/categoryColors.js';
import './Avatar.css';

// Port of frappe-ui Avatar.vue. Shows `image`, or the initials of `label` when
// there is no image or it fails to load.
//
// Initials use the app's `initialsOf` ("Het Patel (Sankalp)" → "HP", bracketed
// text ignored). Frappe shows one letter; two letters are drawn a step
// smaller so they fit the circle, and xs/sm (16/20px) keep one letter.
//
// `children` replaces the initials (an icon). `indicator` is a dot on the
// bottom-right corner: a node, or a colour name ('green' | 'amber' | 'red' |
// 'blue' | 'gray') for a plain status dot.

const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
const THEMES = new Set(['gray', 'blue', 'green', 'amber', 'red', 'violet']);
const DOT_COLORS = new Set(['gray', 'blue', 'green', 'amber', 'red']);
const ONE_LETTER = new Set(['xs', 'sm']);

const cx = (...parts) => parts.filter(Boolean).join(' ');

const Avatar = forwardRef(function Avatar(
  {
    image,
    label,
    size = 'md',
    shape = 'circle',
    theme = 'gray',
    indicator,
    children,
    className,
    ...rest
  },
  ref,
) {
  const s = SIZES.has(size) ? size : 'md';
  const t = THEMES.has(theme) ? theme : 'gray';
  const sh = shape === 'square' ? 'square' : 'circle';

  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const showImage = Boolean(image) && !failed;

  let initials = '';
  if (label) {
    const all = initialsOf(label);
    initials = ONE_LETTER.has(s) ? Array.from(all)[0] || '' : all;
  }
  const twoLetters = Array.from(initials).length > 1;

  // The fallback is drawn, not read: name the whole avatar instead.
  const labelled = !showImage && label && !rest['aria-hidden'];

  return (
    <span
      ref={ref}
      className={cx('ui-avatar', `ui-avatar--${s}`, `ui-avatar--${sh}`, className)}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? label : undefined}
      {...rest}
    >
      {showImage ? (
        <img className="ui-avatar__image" src={image} alt={label || ''} onError={() => setFailed(true)} />
      ) : (
        <span
          className={cx('ui-avatar__fallback', `ui-avatar__fallback--${t}`, twoLetters && 'ui-avatar__fallback--two')}
          aria-hidden="true"
        >
          {children ? <span className="ui-avatar__icon">{children}</span> : initials}
        </span>
      )}
      {indicator ? (
        <span className="ui-avatar__indicator" aria-hidden="true">
          {typeof indicator === 'string' && DOT_COLORS.has(indicator) ? (
            <span className={`ui-avatar__dot ui-avatar__dot--${indicator}`} />
          ) : (
            <span className="ui-avatar__dot">{indicator}</span>
          )}
        </span>
      ) : null}
    </span>
  );
});

export default Avatar;
