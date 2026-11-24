import { useEffect, useState } from 'react';
import { SHORTCUTS } from '../lib/shortcuts';
import { IconClose } from './Icon';

/** 按 ? 呼出的快捷键速查层；ESC 或点背景关闭 */
export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((value) => !value);
    window.addEventListener('mv2:toggle-help', toggle);
    return () => window.removeEventListener('mv2:toggle-help', toggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭快捷键说明"
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        className="mv-panel mv-noise relative w-full max-w-[560px] p-5"
        role="dialog"
        aria-modal="true"
      >
        <header className="mb-4 flex items-center justify-between border-b-2 border-line pb-3">
          <h2 className="font-display text-[24px]">KEYMAP / 快捷键</h2>
          <button
            type="button"
            className="mv-btn !px-2 !py-1"
            onClick={() => setOpen(false)}
            autoFocus
          >
            <IconClose size={14} />
          </button>
        </header>

        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <dt>
                <kbd className="border-2 border-line bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg">
                  {key}
                </kbd>
              </dt>
              <dd className="text-right text-[12px] text-muted">{desc}</dd>
            </div>
          ))}
        </dl>

        <p className="mv-label mt-4">输入框获得焦点时快捷键自动让位</p>
      </div>
    </div>
  );
}
