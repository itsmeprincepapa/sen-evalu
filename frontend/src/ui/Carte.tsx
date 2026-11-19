import type { HTMLAttributes } from 'react';

// Une carte : un bloc blanc aux coins arrondis, avec une ombre légère.
export function Carte({ className = '', ...reste }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}
      {...reste}
    />
  );
}