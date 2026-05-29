import { STYLE_MAP } from '@elaws/shared/styles';

interface Props {
  x: number;
  y: number;
  bottom: number;
  currentStyle: number;
  onPick: (style: number) => void;
  onDelete: () => void;
  onDismiss: () => void;
}

const MARKER_STYLES = [0, 1, 2, 3, 4, 11, 104];
const UNDERLINE_STYLES = [8, 7, 6, 5, 9, 10, 12];

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function EditSelectionMenu({
  x,
  y,
  bottom,
  currentStyle,
  onPick,
  onDelete,
  onDismiss,
}: Props) {
  const coarse = isCoarsePointer();
  const top = coarse ? bottom + 8 : y;
  const translateY = coarse ? '' : '-translate-y-[110%]';
  return (
    <div
      role="dialog"
      data-testid="edit-selection-menu"
      className={`fixed z-50 bg-paper border border-neutral-300 rounded-lg shadow-lg p-2 flex flex-col gap-2 -translate-x-1/2 ${translateY} max-w-[calc(100vw-0.5rem)]`}
      style={{ left: x, top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex gap-1.5 flex-wrap justify-center">
        {MARKER_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          const active = s === currentStyle;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`マーカー ${spec.color} (style=${s})`}
              aria-label={`マーカー ${spec.color}`}
              data-testid={`edit-style-chip-${s}`}
              className={
                'w-11 h-11 rounded shadow-sm border ' +
                (active
                  ? 'border-ink ring-2 ring-ink'
                  : 'border-neutral-200')
              }
              style={{ background: spec.hex }}
            />
          );
        })}
      </div>
      <div className="flex gap-1.5 flex-wrap justify-center">
        {UNDERLINE_STYLES.map((s) => {
          const spec = STYLE_MAP[s]!;
          const active = s === currentStyle;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={`下線 ${spec.color} (style=${s})`}
              aria-label={`下線 ${spec.color}`}
              data-testid={`edit-style-chip-${s}`}
              className={
                'w-11 h-11 rounded-md border flex items-end justify-center pb-2 bg-neutral-50 ' +
                (active
                  ? 'border-ink ring-2 ring-ink'
                  : 'border-neutral-200')
              }
            >
              <span
                className="block w-6 h-1.5 rounded-full"
                style={{ background: spec.hex }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onDelete}
          aria-label="削除"
          data-testid="edit-selection-delete"
          className="h-11 px-4 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium"
        >
          削除
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="キャンセル"
          data-testid="edit-selection-dismiss"
          className="w-11 h-11 rounded-md border border-neutral-200 bg-white text-neutral-500 hover:text-ink hover:bg-neutral-50 text-xl leading-none flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  );
}
