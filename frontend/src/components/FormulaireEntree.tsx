import { useState, type FormEvent } from 'react';
import { entrer, ErreurApi, ErreurReseau } from '../api/passage';
import type { Entree } from '../types';

interface Props {
  lien: string; // le lien aléatoire lu dans l’adresse de la page
  onEntree: (entree: Entree, email: string) => void;
}

// Écran d'entrée : l'étudiant tape son e-mail et le code d'accès donné par l'enseignant.
export function FormulaireEntree({ lien, onEntree }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    // Empêche le navigateur de recharger la page à l'envoi du formulaire.
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);

    try {
      const adresse = email.trim();
      const entree = await entrer(lien, adresse, code.trim());
      // Succès : la page change d'écran (ce formulaire disparaît).
      onEntree(entree, adresse);
    } catch (e) {
      if (e instanceof ErreurReseau) {
        setErreur('Impossible de joindre le serveur. Vérifiez votre connexion.');
      } else if (e instanceof ErreurApi) {
        setErreur(e.message); // ex. « Accès refusé... » ou « Le temps est écoulé. »
      } else {
        setErreur('Une erreur inattendue est survenue.');
      }
      setEnvoi(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <form
        onSubmit={soumettre}
        className="space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <h1 className="text-2xl font-bold">sen-evalu</h1>
        <p className="text-slate-600">
          Entrez votre adresse e-mail et le code d’accès donné par votre
          enseignant.
        </p>

        <label className="block">
          <span className="text-sm font-medium">Adresse e-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Code d’accès</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 font-mono"
          />
        </label>

        {erreur && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="w-full rounded bg-blue-600 p-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {envoi ? 'Vérification…' : 'Commencer'}
        </button>
      </form>
    </main>
  );
}