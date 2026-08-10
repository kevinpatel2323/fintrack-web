import { IcSun, IcMoon, IcAuto } from './Icon.jsx';
import { useTheme } from '../../hooks/useTheme.js';

const OPTIONS = [
  { mode: 'light',  icon: IcSun,  label: 'Light theme' },
  { mode: 'system', icon: IcAuto, label: 'Match system theme' },
  { mode: 'dark',   icon: IcMoon, label: 'Dark theme' },
];

export default function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();

  return (
    <div
      className="ft-theme-toggle"
      role="group"
      aria-label={`Theme — currently ${mode === 'system' ? `system (${resolved})` : mode}`}
    >
      {OPTIONS.map(({ mode: m, icon: Ic, label }) => (
        <button
          key={m}
          type="button"
          className={`ft-theme-toggle__opt${mode === m ? ' is-active' : ''}`}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          title={label}
        >
          <Ic size={15} />
          <span className="ft-sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
