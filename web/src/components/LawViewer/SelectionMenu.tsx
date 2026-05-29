import { STYLE_MAP } from '@elaws/shared/styles';

interface Props {
  x: number;
  /** Viewport Y at the TOP of the selection rect (used when popup goes above). */
  y: number;
  /** Viewport Y at the BOTTOM of the selection rect (used when popup goes below). */
  bottom: number;
  onPick: (style: number) => void;
  onDismiss: () => void;
}

const MARKER_STYLES = [0, 1, 2, 3, 4, 11, 104];
const UNDERLINE_STYLES = [8, 7, 6, 5, 9, 10, 12];

// On touch devices iOS Safari's native selection callout (Copy / Look Up /
// Share) sits directly above the selection rect. Render BELOW the rect
// instead so the two don't overlap. On mouse/desktop keep the original
// "above" placement.
function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function SelectionMenu({ x, y, bottom, onPick, onDismiss }: Props) {
  const coarse = isCoarsePointer();
  const top = coarse ? bottom + 8 : y;
  const translateY = coarse ? '' : '-translate-y-[110%]';
  return (
    <div
      role="dialog"
      data-testid="selection-menu"
      className={`fixed z-50 bg-paper border border-neutral-300 rounded-lg shadow-lg p-2 flex flex-col gap-2 -translate-x-1/2 ${translateY} max-w-[calc(100vw-0.5rem)]`}
      style={{ left: x, top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex gap-1.5 flex-wrap justify-center">
        {MARKER_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`マーカー ${spec.color} (style=${s})`}
              aria-label={`マーカー ${spec.color}`}
              data-testid={`style-chip-${s}`}
              className="w-11 h-11 rounded shadow-sm border border-neutral-200"
              style={{ background: spec.hex }}
            />
          );
        })}
      </div>
      <div className="flex gap-1.5 flex-wrap justify-center">
        {UNDERLINE_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`下線 ${spec.color} (style=${s})`}
              aria-label={`下線 ${spec.color}`}
              data-testid={`style-chip-${s}`}
              className="w-11 h-11 rounded-md border border-neutral-200 flex items-end justify-center pb-2 bg-neutral-50"
            >
              <span
                className="block w-6 h-1.5 rounded-full"
                style={{ background: spec.hex }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-end pt-0.5">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="キャンセル"
          data-testid="selection-menu-dismiss"
          className="w-11 h-11 rounded-md border border-neutral-200 bg-white text-neutral-500 hover:text-ink hover:bg-neutral-50 text-xl leading-none flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  );
}
