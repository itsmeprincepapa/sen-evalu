
import type { ButtonHTMLAttributes } from 'react';
import {
  classesBouton,
  type VarianteBouton,
  type TailleBouton,
} from '../components/bouton.styles';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
}

export function Bouton({
  variante = 'primaire',
  taille = 'm',
  className = '',
  type = 'button',
  ...reste
}: Props) {
  return (
    <button
      type={type}
      className={`${classesBouton(variante, taille)} ${className}`}
      {...reste}
    />
  );
}
