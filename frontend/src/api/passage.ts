import type { AccuseSauvegarde, Contenu, Entree, Etat } from '../types';

// Adresse du serveur : « VITE_API_URL » si elle est définie, sinon le serveur local.
const URL_API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Le serveur a répondu, mais par un refus (403, 401, 400...).
// Le champ « code » (ex. TEMPS_ECOULE) permet à l'écran de réagir précisément.
export class ErreurApi extends Error {
  readonly statut: number;
  readonly code: string | null;

  constructor(statut: number, code: string | null, message: string) {
    super(message);
    this.statut = statut;
    this.code = code;
  }
}

// Le serveur n'a PAS répondu (coupure, serveur arrêté...).
export class ErreurReseau extends Error {}

interface OptionsAppel {
  methode: 'GET' | 'POST' | 'PUT';
  jeton?: string; // jeton de session, envoyé dans l'en-tête Authorization
  corps?: unknown; // données envoyées, transformées en JSON
}

// Fonction commune à tous les appels : elle envoie la requête, lit la réponse
// et transforme les échecs en ErreurApi ou ErreurReseau.
async function appeler<T>(chemin: string, options: OptionsAppel): Promise<T> {
  const entetes: Record<string, string> = {};
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (options.jeton) entetes['Authorization'] = `Bearer ${options.jeton}`;

  let reponse: Response;
  try {
    reponse = await fetch(`${URL_API}${chemin}`, {
      method: options.methode,
      headers: entetes,
      body:
        options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
    });
  } catch {
    // « fetch » échoue seulement si le serveur est injoignable.
    throw new ErreurReseau('Serveur injoignable.');
  }

  // Le serveur répond en JSON ; sinon (page d'erreur), on obtient null.
  const donnees: unknown = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    const d = (donnees ?? {}) as { code?: string; message?: string | string[] };
    const message = Array.isArray(d.message)
      ? d.message.join(' ')
      : (d.message ?? 'Erreur du serveur.');
    throw new ErreurApi(reponse.status, d.code ?? null, message);
  }
  return donnees as T;
}

// --- Les cinq actions du serveur ---

// Entrer avec l'e-mail et le code d'accès (démarre ou reprend l'évaluation).
export const entrer = (lien: string, email: string, codeAcces: string) =>
  appeler<Entree>('/passage/entrer', {
    methode: 'POST',
    corps: { lien, email, codeAcces },
  });

// Relire l'état (après un rechargement de la page).
export const lireEtat = (jeton: string) =>
  appeler<Etat>('/passage/etat', { methode: 'GET', jeton });

// Sauvegarder la réponse à UNE question.
export const sauvegarder = (
  jeton: string,
  questionId: string,
  contenu: Contenu,
  version: number,
) =>
  appeler<AccuseSauvegarde>(`/passage/reponses/${questionId}`, {
    methode: 'PUT',
    jeton,
    corps: { contenu, version },
  });

// Signal « je suis toujours là » (renvoie aussi le temps restant).
export const ping = (jeton: string) =>
  appeler<{ ok: boolean; tempsRestantSecondes: number }>('/passage/ping', {
    methode: 'POST',
    jeton,
  });

// Terminer l'évaluation.
export const terminer = (jeton: string) =>
  appeler<{ ok: boolean }>('/passage/terminer', { methode: 'POST', jeton });