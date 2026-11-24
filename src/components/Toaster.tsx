import { useToasts } from '../state/toast';
import { cx } from '../lib/cx';

const KIND_STYLE: Record<string, string> = {
  info: 'border-ink text-ink',
  accent: 'border-accent bg-accent text-on-accent',
  warn: 'border-clash-1 bg-clash-1 text-white',
};

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-[120px] z-[60] flex flex-col items-end gap-2"
    >
      {toasts.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => dismiss(item.id)}
          className={cx(
            'pointer-events-auto border-2 px-3 py-2 font-mono text-[11px] tracking-widest uppercase shadow-hard-sm',
            KIND_STYLE[item.kind] ?? KIND_STYLE.info,
          )}
          style={{ animation: 'mv-rise 0.18s ease-out both' }}
        >
          ▸ {item.text}
        </button>
      ))}
    </div>
  );
}
