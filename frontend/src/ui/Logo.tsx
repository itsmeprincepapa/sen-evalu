// Le logo de sen-evalu : un carré aux coins arrondis avec une coche.
// Il est dessiné en SVG (pas d'image à charger) et prend la couleur de la marque.
export function Logo({ taille = 32 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 32 32"
      role="img"
      aria-label="sen-evalu"
    >
      <rect width="32" height="32" rx="8" className="fill-marque-600" />
      <path
        d="M9 16.5l4.5 4.5L23 11"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}