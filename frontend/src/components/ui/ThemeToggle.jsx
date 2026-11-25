import { useTheme } from '../../context/ThemeContext.jsx';

const OPTIONS = [
  { id: 'light', icon: '☀', label: 'Light theme' },
  { id: 'system', icon: '◐', label: 'Match system theme' },
  { id: 'dark', icon: '☾', label: 'Dark theme' },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={preference === o.id}
          aria-label={o.label}
          title={o.label}
          className={preference === o.id ? 'active' : ''}
          onClick={() => setPreference(o.id)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
