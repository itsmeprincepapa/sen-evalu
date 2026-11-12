import type { MotifFin } from '../hooks/useSauvegardeAuto';

// Le message affiché selon la raison de la fin.
const MESSAGES: Record<MotifFin, { titre: string; texte: string }> = {
  termine: {
    titre: 'Évaluation terminée',
    texte: 'Vos réponses ont bien été enregistrées. Vous pouvez fermer cette page.',
  },
  temps: {
    titre: 'Le temps est écoulé',
    texte:
      'Les réponses enregistrées avant la fin ont été conservées. Vous pouvez fermer cette page.',
  },
  session: {
    titre: 'Session remplacée',
    texte:
      'Vous vous êtes connecté depuis un autre onglet ou un autre appareil : cette page n’est plus active.',
  },
};

export function EcranFin({ motif }: { motif: MotifFin }) {
  const message = MESSAGES[motif];
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-lg bg-white p-6 text-center shadow">
        <h1 className="mb-2 text-2xl font-bold">{message.titre}</h1>
        <p className="text-slate-600">{message.texte}</p>
      </div>
    </main>
  );
}