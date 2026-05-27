import { useTheme, type ThemePref } from '../state/theme.js';

const LABEL: Record<ThemePref, string> = {
  light: 'ライト',
  dark: 'ダーク',
  system: 'システム',
};

const NEXT: Record<ThemePref, ThemePref> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export function ThemeToggle() {
  const { pref, setPreference } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[pref])}
      title={`テーマ: ${LABEL[pref]} (クリックで切替)`}
      className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      {pref === 'light' ? '☀' : pref === 'dark' ? '☾' : '⌬'}
      <span className="ml-1">{LABEL[pref]}</span>
    </button>
  );
}
