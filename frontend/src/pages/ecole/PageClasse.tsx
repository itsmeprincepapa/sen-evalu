import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ajouterEtudiant,
  etudiantsDeLaClasse,
  importerEtudiants,
  listerClasses,
  renommerClasse,
  retirerEtudiant,
  supprimerClasse,
} from '../../api/classes';
import { EnteteSession } from '../../components/EnteteSession';
import { useErreurs } from '../../hooks/useErreurs';
import { useSession } from '../../session/SessionContext';
import type { EtudiantClasse, ResumeImport } from '../../types';

interface Props {
  idEtablissement: string;
  idClasse: string;
}

// Le contenu de la page, pour UNE classe d'UN établissement.
function ContenuClasse({ idEtablissement, idClasse }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? '';
  const navigate = useNavigate();
  const { erreur, setErreur, traiter } = useErreurs();

  const [nomClasse, setNomClasse] = useState<string | null>(null);
  const [etudiants, setEtudiants] = useState<EtudiantClasse[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Renommer la classe
  const [edition, setEdition] = useState(false);
  const [nouveauNom, setNouveauNom] = useState('');

  // Ajouter UN étudiant
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');

  // Importer une liste collée : le texte, puis l'aperçu renvoyé par le serveur
  const [texte, setTexte] = useState('');
  const [apercu, setApercu] = useState<ResumeImport | null>(null);

    // Le « compteur de rechargement » : on l'augmente pour demander un nouveau chargement
  // (après un ajout, un retrait, un renommage...).
  const [rechargement, setRechargement] = useState(0);
  const recharger = useCallback(() => setRechargement((n) => n + 1), []);

  // Charge le nom de la classe et ses étudiants, au départ puis à chaque rechargement.
  // Les données arrivent dans une « promesse » : les setState sont appelés quand elles
  // sont arrivées, jamais directement dans le corps de l'effet.
  useEffect(() => {
    let annule = false; // devient vrai si on quitte la page avant la réponse

    Promise.all([
      listerClasses(jetonSession, idEtablissement),
      etudiantsDeLaClasse(jetonSession, idEtablissement, idClasse),
    ])
      .then(([classes, liste]) => {
        if (annule) return;
        setNomClasse(classes.find((c) => c.id === idClasse)?.nom ?? null);
        setEtudiants(liste);
      })
      .catch((e: unknown) => {
        if (annule) return;
        traiter(e); // une classe d'une autre école donne « Classe introuvable. »
      });

    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, idClasse, traiter, rechargement]);

  // --- Renommer / supprimer la classe ---

  async function renommer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setInfo(null);
    try {
      await renommerClasse(jetonSession, idEtablissement, idClasse, nouveauNom.trim());
      setEdition(false);
      setInfo('Classe renommée.');
      recharger();
    } catch (e) {
      traiter(e);
    }
  }

  async function supprimer() {
    if (
      !window.confirm(
        `Supprimer la classe « ${nomClasse ?? ''} » ?\n\nLes étudiants restent enregistrés dans l’école.`,
      )
    ) {
      return;
    }
    setErreur(null);
    try {
      await supprimerClasse(jetonSession, idEtablissement, idClasse);
      navigate('/ecole/classes'); // refusé par le serveur si une évaluation y est rattachée
    } catch (e) {
      traiter(e);
    }
  }

  // --- Ajouter / retirer un étudiant ---

  async function ajouter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setInfo(null);
    try {
      await ajouterEtudiant(jetonSession, idEtablissement, idClasse, {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim(),
      });
      setNom('');
      setPrenom('');
      setEmail('');
      setInfo('Étudiant ajouté.');
      recharger();
    } catch (e) {
      traiter(e);
    }
  }

  async function retirer(e: EtudiantClasse) {
    if (
      !window.confirm(
        `Retirer ${e.prenom} ${e.nom} de cette classe ?\n\nSa fiche reste enregistrée dans l’école.`,
      )
    ) {
      return;
    }
    setErreur(null);
    setInfo(null);
    try {
      await retirerEtudiant(jetonSession, idEtablissement, idClasse, e.id);
      recharger();
    } catch (err) {
      traiter(err);
    }
  }

  // --- Importer une liste collée : aperçu, puis confirmation ---

  // Le texte change : l'aperçu précédent ne vaut plus, on l'efface.
  function changerTexte(valeur: string) {
    setTexte(valeur);
    setApercu(null);
  }

  // 1re étape : le serveur ANALYSE la liste, sans rien enregistrer.
  async function analyser() {
    setErreur(null);
    setInfo(null);
    setApercu(null);
    try {
      setApercu(
        await importerEtudiants(jetonSession, idEtablissement, idClasse, texte, false),
      );
    } catch (e) {
      traiter(e);
    }
  }

  // 2e étape : l'enseignant a vu l'aperçu et confirme.
  async function confirmerImport() {
    setErreur(null);
    try {
      const resultat = await importerEtudiants(
        jetonSession,
        idEtablissement,
        idClasse,
        texte,
        true,
      );
      setApercu(null);
      setTexte('');
      const n = resultat.nouveaux + resultat.dejaConnusAjoutes;
      setInfo(`${n} étudiant${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la classe.`);
      recharger();
    } catch (e) {
      traiter(e);
    }
  }

  // Nombre d'étudiants que l'import va réellement ajouter.
  const aAjouter = apercu ? apercu.nouveaux + apercu.dejaConnusAjoutes : 0;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Classe" />

      <Link
        to="/ecole/classes"
        className="mb-4 inline-block text-sm text-blue-700 hover:underline"
      >
        ← Toutes les classes
      </Link>

      {erreur && (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">{info}</p>
      )}

      {/* Si la classe n'a pas pu être chargée (introuvable), on s'arrête là. */}
      {nomClasse === null ? (
        etudiants === null && !erreur ? <p>Chargement…</p> : null
      ) : (
        <>
          {/* Nom de la classe : affichage, ou formulaire de renommage */}
          <section className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-white p-4 shadow">
            {edition ? (
              <form onSubmit={renommer} className="flex flex-1 gap-2">
                <input
                  required
                  value={nouveauNom}
                  onChange={(e) => setNouveauNom(e.target.value)}
                  className="flex-1 rounded border border-slate-300 p-2"
                />
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setEdition(false)}
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                >
                  Annuler
                </button>
              </form>
            ) : (
              <>
                <h2 className="text-xl font-bold">{nomClasse}</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNouveauNom(nomClasse);
                      setEdition(true);
                    }}
                    className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    onClick={() => void supprimer()}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Coller une liste */}
          <section className="mb-6 rounded-lg bg-white p-4 shadow">
            <h3 className="mb-1 font-semibold">Coller une liste d’étudiants</h3>
            <p className="mb-3 text-sm text-slate-600">
              Une ligne par étudiant : <strong>Nom ; Prénom ; E-mail</strong>. Vous
              pouvez aussi copier directement trois colonnes d’Excel.
            </p>
            <textarea
              value={texte}
              onChange={(e) => changerTexte(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={'Diop;Awa;awa@exemple.com\nFall;Cheikh;cheikh@exemple.com'}
              className="w-full rounded border border-slate-300 p-3 font-mono text-sm"
            />
            <button
              type="button"
              disabled={texte.trim() === ''}
              onClick={() => void analyser()}
              className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Analyser la liste
            </button>

            {/* L'aperçu renvoyé par le serveur */}
            {apercu && (
              <div className="mt-4 rounded border border-slate-200 p-3">
                <p className="font-medium">
                  {apercu.reconnus} étudiant{apercu.reconnus > 1 ? 's' : ''} reconnu
                  {apercu.reconnus > 1 ? 's' : ''}, {apercu.erreurs.length} erreur
                  {apercu.erreurs.length > 1 ? 's' : ''}
                </p>
                <ul className="mt-1 text-sm text-slate-700">
                  <li>{apercu.nouveaux} nouveau(x) dans l’école</li>
                  <li>{apercu.dejaConnusAjoutes} déjà connu(s) de l’école, à ajouter à la classe</li>
                  <li>{apercu.dejaDansLaClasse} déjà dans la classe (rien à faire)</li>
                </ul>

                {apercu.erreurs.length > 0 && (
                  <div className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">
                    <p className="font-medium">Lignes ignorées :</p>
                    <ul className="list-disc pl-5">
                      {apercu.erreurs.map((l) => (
                        <li key={l.ligne}>
                          Ligne {l.ligne} : {l.raison}{' '}
                          <span className="font-mono text-xs">« {l.contenu} »</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  disabled={aAjouter === 0}
                  onClick={() => void confirmerImport()}
                  className="mt-3 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {aAjouter === 0
                    ? 'Rien à ajouter'
                    : `Ajouter ${aAjouter} étudiant${aAjouter > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </section>

          {/* Ajouter UN étudiant */}
          <form
            onSubmit={ajouter}
            className="mb-6 space-y-3 rounded-lg bg-white p-4 shadow"
          >
            <h3 className="font-semibold">Ajouter un étudiant</h3>
            <div className="flex gap-3">
              <input
                required
                placeholder="Prénom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="w-full rounded border border-slate-300 p-2"
              />
              <input
                required
                placeholder="Nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full rounded border border-slate-300 p-2"
              />
            </div>
            <input
              required
              type="email"
              placeholder="Adresse e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-300 p-2"
            />
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Ajouter
            </button>
          </form>

          {/* Les étudiants de la classe */}
          <section className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 font-semibold">
              Étudiants de la classe ({etudiants?.length ?? 0})
            </h3>
            {etudiants === null ? (
              <p>Chargement…</p>
            ) : etudiants.length === 0 ? (
              <p className="text-slate-600">
                Aucun étudiant pour le moment : collez une liste ou ajoutez-en un.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {etudiants.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">
                        {e.nom} {e.prenom}
                      </p>
                      <p className="text-sm text-slate-600">{e.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void retirer(e)}
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// La page : elle lit la classe dans l'adresse (/ecole/classes/<id>) et l'établissement actif.
// Le « key » donne un contenu tout neuf quand l'un ou l'autre change.
export function PageClasse() {
  const { id } = useParams<{ id: string }>();
  const { etablissementActif } = useSession();
  if (!id || !etablissementActif) return null;

  return (
    <ContenuClasse
      key={`${etablissementActif.etablissementId}-${id}`}
      idEtablissement={etablissementActif.etablissementId}
      idClasse={id}
    />
  );
}