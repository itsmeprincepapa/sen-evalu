
export type VarianteBouton = 'primaire' | 'secondaire' | 'danger' | 'discret';
export type TailleBouton = 's' | 'm';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTES: Record<VarianteBouton, string> = {
  primaire: 'bg-marque-600 text-white shadow-sm hover:bg-marque-700',
  secondaire: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  discret: 'text-slate-600 hover:bg-slate-100',
};

const TAILLES: Record<TailleBouton, string> = {
  s: 'px-3 py-1.5 text-sm',
  m: 'px-4 py-2 text-sm',
};

export function classesBouton(
  variante: VarianteBouton = 'primaire',
  taille: TailleBouton = 'm',
): string {
  return `${BASE} ${VARIANTES[variante]} ${TAILLES[taille]}`;
}
