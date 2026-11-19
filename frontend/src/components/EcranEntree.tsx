import { useCallback, useEffect, useState, type FormEvent } from "react";
import { lireInfos, lireStatut, sinscrire } from "../api/inscription";
import { ErreurApi, ErreurReseau } from "../api/http";
import { entrer } from "../api/passage";
import type { Entree, InfosInscription, ReponseStatut } from "../types";

interface Props {
  lien: string; // le lien aléatoire lu dans l'adresse de la page
  onEntree: (entree: Entree, email: string) => void;
}

// Les étapes que peut traverser l'étudiant. « etape » est le nom de l'écran affiché.
type Etape =
  | { etape: "chargement" }
  | { etape: "email" } // il tape son e-mail
  | { etape: "inscription" } // il n'a pas de demande : formulaire d'inscription
  | { etape: "attente" } // sa demande attend la validation de l'enseignant
  | { etape: "code"; prenom: string; nom: string } // validé : il saisit le code d'accès
  | { etape: "message"; texte: string }; // situation sans suite (refusé, terminé...)

// Transforme une erreur en phrase lisible pour l'étudiant.
function messageErreur(e: unknown): string {
  if (e instanceof ErreurReseau) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion.";
  }
  if (e instanceof ErreurApi) return e.message;
  return "Une erreur inattendue est survenue.";
}

const CHAMP = "mt-1 w-full rounded border border-slate-300 p-2";
const BOUTON =
  "w-full rounded bg-marque-600 p-2 font-medium text-white hover:bg-marque-700 disabled:opacity-50";

// L'écran d'entrée de l'étudiant : il s'adapte à sa situation (pas inscrit, en attente, validé...).
export function EcranEntree({ lien, onEntree }: Props) {
  const [infos, setInfos] = useState<InfosInscription | null>(null);
  const [etape, setEtape] = useState<Etape>({ etape: "chargement" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Champs des formulaires
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [classeId, setClasseId] = useState("");
  const [code, setCode] = useState("");

  // Au départ : le titre de l'évaluation, les classes, et si les inscriptions sont ouvertes.
  useEffect(() => {
    let annule = false;
    lireInfos(lien)
      .then((i) => {
        if (annule) return;
        setInfos(i);
        setEtape({ etape: "email" });
      })
      .catch((e: unknown) => {
        if (annule) return;
        setEtape({
          etape: "message",
          texte:
            e instanceof ErreurApi && e.statut === 404
              ? "Ce lien n’est pas valide. Vérifiez l’adresse donnée par votre enseignant."
              : messageErreur(e),
        });
      });
    return () => {
      annule = true;
    };
  }, [lien]);

  // Choisit l'écran à afficher selon la situation renvoyée par le serveur.
  const appliquerStatut = useCallback(
    (r: ReponseStatut) => {
      switch (r.statut) {
        case "valide":
        case "en_cours":
          setEtape({ etape: "code", prenom: r.prenom ?? "", nom: r.nom ?? "" });
          break;
        case "en_attente":
          setEtape({ etape: "attente" });
          break;
        case "refuse":
          setEtape({
            etape: "message",
            texte:
              "Votre demande n’a pas été acceptée. Contactez votre enseignant.",
          });
          break;
        case "exclu":
          setEtape({
            etape: "message",
            texte:
              "Vous avez été exclu de cette évaluation. Seul votre enseignant peut vous y réintégrer.",
          });
          break;
        case "termine":
          setEtape({
            etape: "message",
            texte: "Votre participation à cette évaluation est terminée.",
          });
          break;
        case "inconnu":
          if (r.inscriptionsOuvertes ?? infos?.inscriptionsOuvertes) {
            setEtape({ etape: "inscription" });
            setEmail2("");
          } else {
            setEtape({
              etape: "message",
              texte:
                "Cette adresse n’est pas inscrite et les inscriptions sont fermées. Contactez votre enseignant.",
            });
          }
          break;
      }
    },
    [infos],
  );

  // Pendant l'attente de la validation : on redemande le statut toutes les 15 secondes,
  // pour que l'écran change tout seul dès que l'enseignant a validé.
  useEffect(() => {
    if (etape.etape !== "attente") return;
    const id = setInterval(() => {
      lireStatut(lien, email.trim())
        .then((r) => {
          if (r.statut !== "en_attente") appliquerStatut(r);
        })
        .catch(() => {
          // Coupure passagère : on réessaiera au prochain tour.
        });
    }, 15_000);
    return () => clearInterval(id);
  }, [etape.etape, lien, email, appliquerStatut]);

  // Étape « e-mail » : on demande au serveur où en est cette adresse.
  async function verifierEmail(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setOccupe(true);
    try {
      appliquerStatut(await lireStatut(lien, email.trim()));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  // Étape « inscription » : l'étudiant envoie sa demande.
  async function envoyerInscription(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    // L'adresse est saisie DEUX fois : une faute de frappe empêcherait de recevoir la note.
    if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) {
      setErreur("Les deux adresses e-mail ne sont pas identiques.");
      return;
    }

    setOccupe(true);
    try {
      await sinscrire(lien, {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim(),
        classeId,
      });
      setEtape({ etape: "attente" });
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 409) {
        // Une demande existe déjà avec cette adresse : on affiche où elle en est.
        try {
          appliquerStatut(await lireStatut(lien, email.trim()));
        } catch (e2) {
          setErreur(messageErreur(e2));
        }
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setOccupe(false);
    }
  }

  // Étape « code » : l'étudiant validé saisit le code d'accès donné par l'enseignant.
  async function soumettreCode(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setOccupe(true);
    try {
      const entree = await entrer(lien, email.trim(), code.trim());
      onEntree(entree, email.trim()); // la page passe à l'évaluation
    } catch (e) {
      setErreur(messageErreur(e));
      setOccupe(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">{infos?.titre ?? "sen-evalu"}</h1>

        {/* Chargement */}
        {etape.etape === "chargement" && (
          <p className="text-slate-600">Chargement…</p>
        )}

        {/* Étape 1 : l'e-mail */}
        {etape.etape === "email" && (
          <form onSubmit={verifierEmail} className="space-y-4">
            <p className="text-slate-600">
              Entrez votre adresse e-mail pour commencer ou reprendre.
            </p>
            <label className="block">
              <span className="text-sm font-medium">Adresse e-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={CHAMP}
              />
            </label>
            <button type="submit" disabled={occupe} className={BOUTON}>
              {occupe ? "Vérification…" : "Continuer"}
            </button>
          </form>
        )}

        {/* Étape 2a : le formulaire d'inscription */}
        {etape.etape === "inscription" && (
          <form onSubmit={envoyerInscription} className="space-y-3">
            <p className="text-slate-600">
              Cette adresse n’est pas encore inscrite. Remplissez le formulaire
              : votre enseignant validera votre demande.
            </p>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className="text-sm font-medium">Prénom</span>
                <input
                  required
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className={CHAMP}
                />
              </label>
              <label className="block flex-1">
                <span className="text-sm font-medium">Nom</span>
                <input
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className={CHAMP}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Adresse e-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={CHAMP}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Confirmez l’adresse e-mail
              </span>
              <input
                type="email"
                required
                value={email2}
                onChange={(e) => setEmail2(e.target.value)}
                onPaste={(e) => e.preventDefault()} // oblige à la retaper vraiment
                className={CHAMP}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Votre classe</span>
              <select
                required
                value={classeId}
                onChange={(e) => setClasseId(e.target.value)}
                className={CHAMP}
              >
                <option value="">Choisissez…</option>
                {infos?.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-slate-500">
              Votre note sera envoyée à cette adresse : vérifiez qu’elle est
              exacte.
            </p>
            <button type="submit" disabled={occupe} className={BOUTON}>
              {occupe ? "Envoi…" : "Envoyer ma demande"}
            </button>
          </form>
        )}

        {/* Étape 2b : en attente de la validation */}
        {etape.etape === "attente" && (
          <div className="space-y-3">
            <p className="rounded bg-marque-50 p-3 text-marque-900">
              Demande envoyée. Attendez la validation de votre enseignant : cet
              écran se met à jour tout seul.
            </p>
            <button
              type="button"
              disabled={occupe}
              onClick={() => {
                setOccupe(true);
                lireStatut(lien, email.trim())
                  .then((r) => appliquerStatut(r))
                  .catch((e: unknown) => setErreur(messageErreur(e)))
                  .finally(() => setOccupe(false));
              }}
              className="w-full rounded border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-50"
            >
              Vérifier maintenant
            </button>
          </div>
        )}

        {/* Étape 3 : validé, il saisit le code d'accès */}
        {etape.etape === "code" && (
          <form onSubmit={soumettreCode} className="space-y-4">
            <p className="text-lg">
              Bonjour{" "}
              <strong>
                {etape.prenom} {etape.nom}
              </strong>
              .
            </p>
            <label className="block">
              <span className="text-sm font-medium">Code d’accès</span>
              <input
                required
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${CHAMP} font-mono`}
              />
            </label>
            <button type="submit" disabled={occupe} className={BOUTON}>
              {occupe ? "Vérification…" : "Commencer l’évaluation"}
            </button>
          </form>
        )}

        {/* Les situations sans suite */}
        {etape.etape === "message" && (
          <p className="rounded bg-orange-50 p-3 text-orange-900">
            {etape.texte}
          </p>
        )}

        {erreur && (
          <p
            role="alert"
            className="rounded bg-red-50 p-3 text-sm text-red-700"
          >
            {erreur}
          </p>
        )}
      </div>
    </main>
  );
}
