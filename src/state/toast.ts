import { create } from 'zustand';

export type ToastKind = 'info' | 'warn' | 'accent';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: Toast[];
  push: (text: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastStore>()((set, get) => ({
  toasts: [],
  push(text, kind = 'info') {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] });
    window.setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));

export const toast = (text: string, kind: ToastKind = 'info') =>
  useToasts.getState().push(text, kind);
