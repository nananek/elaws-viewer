import { useEffect, useRef, useState } from 'react';

/**
 * vim-style article jump: `g` then digits then Enter.
 *
 * - Inactive when focus is in an input/textarea/contenteditable.
 * - Press `g` to enter "pending jump" mode. A small badge can be rendered from
 *   the returned `buffer`.
 * - Type digits (and the separators `_` / `の` for branch articles) — they
 *   are appended to the buffer.
 * - Enter → fires `onJump('条<buffer>')` and clears.
 * - Escape or any other key cancels.
 * - Auto-cancel after 2.5s of inactivity.
 */
export function useArticleJumpShortcut(onJump: (anchor: string) => void) {
  const [buffer, setBuffer] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setBuffer(null), 2500);
    }

    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (buffer === null) {
        if (e.key === 'g') {
          e.preventDefault();
          setBuffer('');
          resetTimer();
        }
        return;
      }

      // buffering
      if (e.key === 'Escape') {
        e.preventDefault();
        setBuffer(null);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (buffer.length > 0) onJump(`条${buffer}`);
        setBuffer(null);
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setBuffer((b) => (b ?? '') + e.key);
        resetTimer();
        return;
      }
      if (e.key === '_' || e.key === 'の') {
        e.preventDefault();
        setBuffer((b) => ((b ?? '').endsWith('_') ? b! : (b ?? '') + '_'));
        resetTimer();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setBuffer((b) => (b ?? '').slice(0, -1));
        resetTimer();
        return;
      }
      // any other key — cancel
      setBuffer(null);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [buffer, onJump]);

  return buffer;
}
