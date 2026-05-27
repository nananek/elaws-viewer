import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'elaws.theme';

function readPref(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function resolveEffective(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function apply(effective: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', effective === 'dark');
  root.style.colorScheme = effective;
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    apply(resolveEffective(pref));

    if (pref === 'system' && typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => apply(resolveEffective('system'));
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [pref]);

  function setPreference(next: ThemePref) {
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    setPref(next);
  }

  return { pref, setPreference };
}

/**
 * Inline pre-paint script. Embed in index.html <head> so the dark class
 * is set before React mounts, avoiding a light-mode flash on dark.
 */
export const themeInitScript = `
(function(){
  try {
    var v = localStorage.getItem('${STORAGE_KEY}');
    var dark = v === 'dark' || (v !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch(_) {}
})();
`.trim();
