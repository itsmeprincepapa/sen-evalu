import type { ReactNode } from 'react';

export type TypeAlerte = 'erreur' | 'succes' | 'info' | 'attention';

const STYLES: Record<TypeAlerte, string> = {
  erreur: 'bg-red-50 text-red-800 ring-red-200',
  succes: 'bg-marque-50 text-marque-900 ring-marque-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  attention: 'bg-amber-50 text-amber-900 ring-amber-200',
};

interface Props {
  type?: TypeAlerte;
  children: ReactNode;
  className?: string;
}

// Un message encadré. Les erreurs sont annoncées d'office par les lecteurs d'écran (role="alert").
export function Alerte({ type = 'info', children, className = '' }: Props) {
  return (
    <div
      role={type === 'erreur' ? 'alert' : 'status'}
      className={`rounded-lg p-3 text-sm ring-1 ${STYLES[type]} ${className}`}
    >
      {children}
    </div>
  );
}