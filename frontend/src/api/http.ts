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

export interface OptionsAppel {
  methode: 'GET' | 'POST' | 'PUT' | 'PATCH';
  jeton?: string; // jeton de session, envoyé dans l'en-tête Authorization
  etablissementId?: string; // établissement choisi, envoyé dans l'en-tête X-Etablissement
  corps?: unknown; // données envoyées, transformées en JSON
}

// Fonction commune à tous les appels : elle envoie la requête, lit la réponse
// et transforme les échecs en ErreurApi ou ErreurReseau.
export async function appeler<T>(
  chemin: string,
  options: OptionsAppel,
): Promise<T> {
  const entetes: Record<string, string> = {};
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (options.jeton) entetes['Authorization'] = `Bearer ${options.jeton}`;
  if (options.etablissementId) {
    entetes['X-Etablissement'] = options.etablissementId;
  }

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