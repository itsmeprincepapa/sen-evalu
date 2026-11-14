import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { ErreurApi, ErreurReseau } from '../api/http';
import { useSession } from '../session/SessionContext';

// L'identifiant client Google, lu dans le fichier frontend/.env (VITE_GOOGLE_CLIENT_ID).
const ID_CLIENT_GOOGLE: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function PageConnexion() {
  const { etat, profil, connecter } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);

  // Déjà connecté : on file vers l'accueil.
  if (etat === 'connecte' && profil) {
    return <Navigate to="/" replace />;
  }

  // Google a identifié la personne : on envoie son jeton à NOTRE serveur, qui le vérifie
  // et qui décide si elle a le droit d'entrer.
  async function apresGoogle(credential: string | undefined) {
    setErreur(null);
    if (!credential) {
      setErreur('Google n’a pas fourni de jeton. Réessayez.');
      return;
    }
    try {
      await connecter(credential); // en cas de succès, la page redirige toute seule
    } catch (e) {
      if (e instanceof ErreurReseau) {
        setErreur('Impossible de joindre le serveur. Réessayez dans un instant.');
      } else if (e instanceof ErreurApi) {
        setErreur(e.message); // ex. « Connexion refusée : ce compte Google n’est pas autorisé... »
      } else {
        setErreur('Une erreur inattendue est survenue.');
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="space-y-4 rounded-lg bg-white p-6 text-center shadow">
        <h1 className="text-2xl font-bold">sen-evalu</h1>
        <p className="text-slate-600">
          Espace des enseignants et des administrateurs. Connectez-vous avec
          votre compte Google.
        </p>

        {!ID_CLIENT_GOOGLE ? (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
            Configuration manquante : ajoutez VITE_GOOGLE_CLIENT_ID dans
            frontend/.env puis relancez « npm run dev ».
          </p>
        ) : (
          // Le « provider » charge le script de Google et lui donne notre identifiant client.
          <GoogleOAuthProvider clientId={ID_CLIENT_GOOGLE}>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(reponse) => void apresGoogle(reponse.credential)}
                onError={() =>
                  setErreur('La connexion Google a échoué ou a été annulée.')
                }
                locale="fr"
              />
            </div>
          </GoogleOAuthProvider>
        )}

        {erreur && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <p className="text-xs text-slate-500">
          Vous êtes étudiant ? Utilisez le lien donné par votre enseignant.
        </p>
      </div>
    </main>
  );
}