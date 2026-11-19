import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  libelle: string; // le texte affiché au-dessus du champ
  aide?: string; // une petite phrase d'explication sous le champ
}

// Un champ de saisie avec son libellé. Le libellé est relié au champ (clic sur le libellé = focus).
export function Champ({ libelle, aide, className = '', id, ...reste }: Props) {
  const identifiantAuto = useId(); // un identifiant unique fabriqué par React
  const identifiant = id ?? identifiantAuto;

  return (
    <div>
      <label htmlFor={identifiant} className="block text-sm font-medium text-slate-700">
        {libelle}
      </label>
      <input
        id={identifiant}
        className={`mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200 ${className}`}
        {...reste}
      />
      {aide && <p className="mt-1 text-xs text-slate-500">{aide}</p>}
    </div>
  );
}