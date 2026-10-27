import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Dropdown from './Dropdown.jsx';
import Tooltip from './Tooltip.jsx';
import { avatarTheme, visibleCount } from './internal/avatarGroupLayout.js';
import './AvatarGroup.css';

export { avatarTheme };

// A stack of people, the way Jira shows assignees and watchers: overlapping
// initials avatars, each named on hover and linking to the person; when they
// don't all fit, the last slot becomes a "+N" chip that lists the rest.
//
// How many show is decided by the room the group actually has (it measures
// itself), capped by `max`, so the same group works in a narrow table column
// and a wide panel.
//
// `interactive={false}` draws the same stack as plain markup (no links, hover
// names or menu), for use inside another control such as a row button.

export default function AvatarGroup({
  people = [],
  size = 'md',
  max = 5,
  label = 'People',
  interactive = true,
  className = '',
}) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!people.length) return null;

  const shown = visibleCount(people.length, width, { size, max });
  const head = people.slice(0, shown);
  const rest = people.slice(shown);
  const names = people.map((p) => p.name).join(', ');

  return (
    <div
      ref={ref}
      className={`ui-avatar-group ui-avatar-group--${size} ${className}`.trim()}
      role={interactive ? 'group' : 'img'}
      aria-label={`${label}: ${names}`}
    >
      {!interactive &&
        head.map((person, i) => (
          <span key={person.id ?? `${person.name}-${i}`} className="ui-avatar-group__item" aria-hidden="true">
            <Avatar label={person.name} size={size} theme={avatarTheme(person.id ?? person.name)} aria-hidden />
          </span>
        ))}
      {!interactive && rest.length > 0 && (
        <span className="ui-avatar-group__item ui-avatar-group__more" aria-hidden="true">+{rest.length}</span>
      )}
      {interactive && head.map((person, i) => {
        const avatar = (
          <Avatar label={person.name} size={size} theme={avatarTheme(person.id ?? person.name)} aria-hidden />
        );
        return (
          <Tooltip key={person.id ?? `${person.name}-${i}`} text={person.name}>
            {person.to ? (
              <Link to={person.to} className="ui-avatar-group__item" aria-label={person.name}>
                {avatar}
              </Link>
            ) : (
              <span className="ui-avatar-group__item" tabIndex={0} aria-label={person.name}>
                {avatar}
              </span>
            )}
          </Tooltip>
        );
      })}
      {interactive && rest.length > 0 && (
        <Dropdown
          placement="bottom-end"
          options={rest.map((person) => ({
            label: person.name,
            icon: <Avatar label={person.name} size="sm" theme={avatarTheme(person.id ?? person.name)} aria-hidden />,
            to: person.to,
          }))}
        >
          <button
            type="button"
            className="ui-avatar-group__item ui-avatar-group__more"
            aria-label={`${rest.length} more: ${rest.map((p) => p.name).join(', ')}`}
          >
            +{rest.length}
          </button>
        </Dropdown>
      )}
    </div>
  );
}
