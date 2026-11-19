import type { ReactNode } from 'react';

export type TonBadge = 'neutre' | 'succes' | 'attention' | 'danger' | 'info';

const TONS: Record<TonBadge, string> = {
  neutre: 'bg-slate-100 text-slate-700',
  succes: 'bg-marque-100 text-marque-800',
  attention: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
};

// Une petite étiquette colorée (un état, un rôle...).
export function Badge({
  ton = 'neutre',
  children,
}: {
  ton?: TonBadge;
  children: ReactNode;
}) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS[ton]}`}>
      {children}
    </span>
  );
}