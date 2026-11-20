import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { listerClasses } from "../../api/classes";
import {
  creerEvaluation,
  definirCodeEvaluation,
  lireEvaluation,
  modifierEvaluation,
  planifierEvaluation,
  repasserEnBrouillonEvaluation,
  supprimerEvaluation,
} from "../../api/evaluations";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { dateLocaleVersUtc, utcVersDateLocale } from "../../lib/dates";
import { LIBELLES_STATUT_EVALUATION } from "../../lib/libelles";
import { useSession } from "../../session/SessionContext";
import type { ClasseResume, DetailEvaluation, ModificationEvaluation } from "../../types";
import { Alerte } from "../../ui/Alerte";
import { Bouton } from "../../ui/Bouton";
import { Carte } from "../../ui/Carte";
import { Champ } from "../../ui/Champ";

// Les champs du formulaire. Les champs HTML manipulent du texte ou des cases cochées :
// les nombres sont donc gardés sous forme de texte, et vérifiés à l'enregistrement.
interface Formulaire {
  titre: string;
  debut: string; // heure locale, ex. « 2026-12-01T09:00 »
  fin: string;
  dureeMinutes: string;
  classeIds: string[];
  inscriptionsOuvertes: boolean;
  inscriptionsFermeLe: string; // vide = pas de date de fermeture
  pleinEcranObligatoire: boolean;
  detecterChangementOnglet: boolean;
  melangerQuestions: boolean;
  navigationLibre: boolean;
  retourEnArriere: boolean;
  toleranceCoupureSecondes: string;
  seuilIncidentsGraves: string;
}

const FORMULAIRE_VIDE: Formulaire = {
  titre: "",
  debut: "",
  fin: "",
  dureeMinutes: "60",
  classeIds: [],
  inscriptionsOuvertes: true,
  inscriptionsFermeLe: "",
  pleinEcranObligatoire: true,
  detecterChangementOnglet: true,
  melangerQuestions: false,
  navigationLibre: true,
  retourEnArriere: true,
  toleranceCoupureSecondes: "60",
  seuilIncidentsGraves: "2",
};

// Remplit le formulaire avec ce que le serveur a renvoyé.
function versFormulaire(d: DetailEvaluation): Formulaire {
  return {
    titre: d.titre,
    debut: utcVersDateLocale(d.debut),
    fin: utcVersDateLocale(d.fin),
    dureeMinutes: String(d.dureeMinutes),
    classeIds: d.classes.map((c) => c.id),
    inscriptionsOuvertes: d.inscriptionsOuvertes,
    inscriptionsFermeLe: utcVersDateLocale(d.inscriptionsFermeLe),
    pleinEcranObligatoire: d.options.pleinEcranObligatoire,
    detecterChangementOnglet: d.options.detecterChangementOnglet,
    melangerQuestions: d.options.melangerQuestions,
    navigationLibre: d.options.navigationLibre,
    retourEnArriere: d.options.retourEnArriere,
    toleranceCoupureSecondes: String(d.options.toleranceCoupureSecondes),
    seuilIncidentsGraves: String(d.options.seuilIncidentsGraves),
  };
}

// Vérifie qu'un texte est un nombre entier dans la bonne plage, et le renvoie.
function entier(texte: string, nom: string, min: number, max: number): number {
  const n = Number(texte);
  if (texte.trim() === "" || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${nom} doit être un nombre entier entre ${min} et ${max}.`);
  }
  return n;
}

// Convertit une date saisie (heure locale) en UTC, ou refuse si elle est vide.
function dateUtc(valeur: string, nom: string): string {
  const iso = dateLocaleVersUtc(valeur);
  if (iso === null) throw new Error(`${nom} : choisissez une date et une heure.`);
  return iso;
}

// Une case à cocher avec son texte (et une petite aide facultative).
function CaseACocher({
  libelle,
  aide,
  coche,
  onChange,
}: {
  libelle: string;
  aide?: string;
  coche: boolean;
  onChange: (coche: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-marque-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{libelle}</span>
        {aide && <span className="block text-xs text-slate-500">{aide}</span>}
      </span>
    </label>
  );
}

// Un bloc pour UN code (d'accès ou de sortie) : générer ou choisir, puis l'afficher UNE fois.
function BlocCode({
  titre,
  explication,
  defini,
  modifiable,
  onDefinir,
  onErreur,
}: {
  titre: string;
  explication: string;
  defini: boolean;
  modifiable: boolean;
  onDefinir: (code?: string) => Promise<string>;
  onErreur: (e: unknown) => void;
}) {
  const [choisi, setChoisi] = useState(""); // le code que l'enseignant veut utiliser (facultatif)
  const [affiche, setAffiche] = useState<string | null>(null); // le code, montré une seule fois
  const [copie, setCopie] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function lancer() {
    setEnCours(true);
    setCopie(false);
    try {
      const code = await onDefinir(choisi.trim() === "" ? undefined : choisi.trim());
      setAffiche(code);
      setChoisi("");
    } catch (e) {
      onErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(affiche ?? "");
      setCopie(true);
    } catch {
      // Copie impossible : le code reste affiché, on peut le recopier à la main.
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{titre}</h3>
        <span
          className={`rounded px-2 py-1 text-xs ${
            defini ? "bg-marque-50 text-marque-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          {defini ? "Défini" : "Non défini"}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{explication}</p>

      {affiche && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <p className="font-mono text-2xl font-bold tracking-widest text-slate-900">
              {affiche}
            </p>
            <Bouton variante="secondaire" taille="s" onClick={() => void copier()}>
              {copie ? "Copié !" : "Copier"}
            </Bouton>
          </div>
          <Alerte type="attention">
            Notez ce code maintenant : il ne sera plus jamais affiché. Si vous le
            perdez, il faudra en générer un nouveau.
          </Alerte>
        </div>
      )}

      {modifiable ? (
        <div className="mt-3 space-y-3">
          <Champ
            libelle="Choisir un code (facultatif)"
            aide="4 à 20 lettres ou chiffres, sans accent. Laissez vide pour un code de 6 chiffres généré pour vous."
            value={choisi}
            onChange={(e) => setChoisi(e.target.value)}
            maxLength={20}
          />
          <Bouton variante="secondaire" disabled={enCours} onClick={() => void lancer()}>
            {choisi.trim() !== ""
              ? "Enregistrer ce code"
              : defini
                ? "Générer un nouveau code"
                : "Générer un code"}
          </Bouton>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Les codes ne peuvent plus être changés une fois l’évaluation commencée.
        </p>
      )}
    </div>
  );
}

interface Props {
  idEtablissement: string;
  idEvaluation: string | undefined; // absent : on crée une nouvelle évaluation
}

// Le contenu de la page, pour UN établissement et UNE évaluation (ou une création).
function ContenuFormulaire({ idEtablissement, idEvaluation }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const navigate = useNavigate();
  const { erreur, setErreur, traiter } = useErreurs();

  const creation = idEvaluation === undefined;

  const [f, setF] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [detail, setDetail] = useState<DetailEvaluation | null>(null);
  const [classes, setClasses] = useState<ClasseResume[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [lienCopie, setLienCopie] = useState(false);
  // L'heure d'ouverture de la page, pour vérifier que la fin de la plage est dans le futur.
  const [maintenant] = useState(() => Date.now());

  // Charge les classes de l'école et, pour une modification, l'évaluation.
  // Les données arrivent dans une « promesse » : le setState est appelé quand elles
  // sont arrivées, jamais directement dans le corps de l'effet.
  useEffect(() => {
    let annule = false;
    Promise.all([
      listerClasses(jetonSession, idEtablissement),
      idEvaluation
        ? lireEvaluation(jetonSession, idEtablissement, idEvaluation)
        : Promise.resolve(null),
    ])
      .then(([liste, d]) => {
        if (annule) return;
        setClasses(liste);
        if (d) {
          setDetail(d);
          setF(versFormulaire(d));
        }
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e);
      });
    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, idEvaluation, traiter]);

  // Change UN champ du formulaire.
  function maj<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setF((avant) => ({ ...avant, [cle]: valeur }));
  }

  // Coche ou décoche une classe.
  function basculerClasse(id: string) {
    setF((avant) => ({
      ...avant,
      classeIds: avant.classeIds.includes(id)
        ? avant.classeIds.filter((c) => c !== id)
        : [...avant.classeIds, id],
    }));
  }

  async function enregistrer(ev: FormEvent) {
    ev.preventDefault();
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      if (creation) {
        // --- Création : titre, plage, durée, classes ---
        const cree = await creerEvaluation(jetonSession, idEtablissement, {
          titre: f.titre.trim(),
          debut: dateUtc(f.debut, "Le début"),
          fin: dateUtc(f.fin, "La fin"),
          dureeMinutes: entier(f.dureeMinutes, "La durée", 1, 1440),
          classeIds: f.classeIds,
        });
        // On ouvre directement la page de modification de l'évaluation créée.
        void navigate(`/ecole/evaluations/${cree.id}/modifier`, { replace: true });
        return;
      }

      // --- Modification : les inscriptions sont toujours envoyées ---
      const donnees: ModificationEvaluation = {
        inscriptionsOuvertes: f.inscriptionsOuvertes,
        inscriptionsFermeLe:
          f.inscriptionsFermeLe === ""
            ? null
            : dateUtc(f.inscriptionsFermeLe, "La fermeture des inscriptions"),
      };
      // Le reste n'est envoyé que si l'évaluation est encore modifiable
      // (le serveur refuse tout changement de fond une fois l'évaluation commencée).
      if (detail?.modifiable) {
        donnees.titre = f.titre.trim();
        donnees.debut = dateUtc(f.debut, "Le début");
        donnees.fin = dateUtc(f.fin, "La fin");
        donnees.dureeMinutes = entier(f.dureeMinutes, "La durée", 1, 1440);
        donnees.classeIds = f.classeIds;
        donnees.pleinEcranObligatoire = f.pleinEcranObligatoire;
        donnees.detecterChangementOnglet = f.detecterChangementOnglet;
        donnees.melangerQuestions = f.melangerQuestions;
        donnees.navigationLibre = f.navigationLibre;
        donnees.retourEnArriere = f.retourEnArriere;
        donnees.toleranceCoupureSecondes = entier(
          f.toleranceCoupureSecondes,
          "La tolérance de coupure",
          0,
          600,
        );
        donnees.seuilIncidentsGraves = entier(
          f.seuilIncidentsGraves,
          "Le nombre d'incidents graves",
          1,
          10,
        );
      }

      const resultat = await modifierEvaluation(
        jetonSession,
        idEtablissement,
        idEvaluation,
        donnees,
      );
      setDetail(resultat);
      setF(versFormulaire(resultat));
      setInfo("Modifications enregistrées.");
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  // Un code généré ou choisi : on le renvoie au bloc, qui l'affiche une seule fois.
  async function definirCode(quel: "acces" | "sortie", code?: string): Promise<string> {
    if (!idEvaluation) throw new Error("Évaluation inconnue.");
    setErreur(null);
    const resultat = await definirCodeEvaluation(
      jetonSession,
      idEtablissement,
      idEvaluation,
      quel,
      code,
    );
    // On note que le code est maintenant défini (le serveur ne le renverra plus jamais).
    setDetail((d) =>
      d
        ? {
            ...d,
            codeAccesDefini: quel === "acces" ? true : d.codeAccesDefini,
            codeSortieDefini: quel === "sortie" ? true : d.codeSortieDefini,
          }
        : d,
    );
    return resultat.code;
  }

  async function supprimer() {
    if (!idEvaluation) return;
    if (!window.confirm("Supprimer ce brouillon ? Cette action est définitive.")) return;
    try {
      await supprimerEvaluation(jetonSession, idEtablissement, idEvaluation);
      void navigate("/ecole/evaluations", { replace: true });
    } catch (e) {
      traiter(e);
    }
  }

  // Passe le brouillon en « planifiée » : le lien s'ouvre aux étudiants.
  // (Le serveur refuse en listant ce qui manque, et traiter() affiche ce message.)
  async function planifier() {
    if (!idEvaluation) return;
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      const resultat = await planifierEvaluation(jetonSession, idEtablissement, idEvaluation);
      setDetail(resultat);
      setInfo("Évaluation planifiée : les étudiants peuvent maintenant s’inscrire avec le lien.");
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  // Referme le lien : possible seulement tant qu'aucun étudiant n'est entré.
  async function repasserEnBrouillon() {
    if (!idEvaluation) return;
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      const resultat = await repasserEnBrouillonEvaluation(
        jetonSession,
        idEtablissement,
        idEvaluation,
      );
      setDetail(resultat);
      setInfo("L’évaluation est repassée en brouillon : le lien est fermé aux étudiants.");
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function copierLien(lien: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${lien}`);
      setLienCopie(true);
    } catch {
      // Copie impossible : l'adresse reste sélectionnable à la main.
    }
  }

  const titrePage = creation ? "Nouvelle évaluation" : "Modifier l’évaluation";
  const pret = classes !== null && (creation || detail !== null);

  // Le fond (titre, dates, classes, options) est verrouillé une fois l'évaluation commencée.
  const fondVerrouille = !creation && detail !== null && !detail.modifiable;
  // Les inscriptions restent réglables jusqu'à la fin de l'évaluation.
  const inscriptionsReglables =
    detail !== null && ["brouillon", "planifiee", "en_cours"].includes(detail.statut);

  // Ce qu'il faut avoir avant de planifier (calculé sur les données ENREGISTRÉES).
  const verifications = detail
    ? [
        { ok: detail.nombreQuestions > 0, texte: "Au moins une question" },
        { ok: detail.codeAccesDefini, texte: "Code d'accès défini" },
        { ok: detail.codeSortieDefini, texte: "Code de sortie défini" },
        { ok: detail.classes.length > 0, texte: "Au moins une classe rattachée" },
        {
          ok: new Date(detail.fin).getTime() > maintenant,
          texte: "La fin de la plage horaire est dans le futur",
        },
      ]
    : [];
  const toutEstPret = verifications.every((v) => v.ok);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre={titrePage} />

      <Link
        to="/ecole/evaluations"
        className="mb-4 inline-block text-sm text-marque-700 hover:underline"
      >
        ← Retour à mes évaluations
      </Link>

      {erreur && <Alerte type="erreur" className="mb-4">{erreur}</Alerte>}
      {info && <Alerte type="succes" className="mb-4">{info}</Alerte>}

      {!pret ? (
        <p>Chargement…</p>
      ) : (
        <div className="space-y-4">
          {detail && (
            <p className="text-sm text-slate-600">
              État :{" "}
              <strong>{LIBELLES_STATUT_EVALUATION[detail.statut] ?? detail.statut}</strong>
              {fondVerrouille &&
                " · L’évaluation a commencé : seules les inscriptions peuvent encore être modifiées."}
            </p>
          )}

          <form onSubmit={(ev) => void enregistrer(ev)} className="space-y-4">
            {/* --- Informations générales --- */}
            <Carte>
              <fieldset disabled={fondVerrouille} className="space-y-4">
                <legend className="mb-2 text-lg font-semibold text-slate-900">
                  Informations
                </legend>
                <Champ
                  libelle="Titre"
                  value={f.titre}
                  onChange={(e) => maj("titre", e.target.value)}
                  maxLength={200}
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ
                    libelle="Début de la plage horaire"
                    type="datetime-local"
                    value={f.debut}
                    onChange={(e) => maj("debut", e.target.value)}
                    required
                  />
                  <Champ
                    libelle="Fin de la plage horaire"
                    type="datetime-local"
                    value={f.fin}
                    onChange={(e) => maj("fin", e.target.value)}
                    required
                  />
                </div>
                <Champ
                  libelle="Durée par étudiant (minutes)"
                  aide="Elle doit tenir dans la plage horaire. Un étudiant qui arrive tard garde seulement le temps restant de la plage."
                  type="number"
                  min={1}
                  max={1440}
                  value={f.dureeMinutes}
                  onChange={(e) => maj("dureeMinutes", e.target.value)}
                  required
                />

                <div>
                  <p className="text-sm font-medium text-slate-700">Classes concernées</p>
                  {classes.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">
                      Aucune classe dans cette école.{" "}
                      <Link to="/ecole/classes" className="text-marque-700 hover:underline">
                        Créer une classe
                      </Link>
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {classes.map((c) => (
                        <CaseACocher
                          key={c.id}
                          libelle={c.nom}
                          aide={`${c.nbEtudiants} étudiant${c.nbEtudiants > 1 ? "s" : ""}`}
                          coche={f.classeIds.includes(c.id)}
                          onChange={() => basculerClasse(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </fieldset>
            </Carte>

            {creation && (
              <Alerte type="info">
                Après la création, vous pourrez régler les options, les inscriptions et
                les codes.
              </Alerte>
            )}

            {!creation && detail && (
              <>
                {/* --- Inscriptions --- */}
                <Carte>
                  <fieldset disabled={!inscriptionsReglables} className="space-y-4">
                    <legend className="mb-2 text-lg font-semibold text-slate-900">
                      Inscriptions des étudiants
                    </legend>
                    <CaseACocher
                      libelle="Inscriptions ouvertes"
                      aide="Les étudiants peuvent demander leur inscription avec le lien."
                      coche={f.inscriptionsOuvertes}
                      onChange={(v) => maj("inscriptionsOuvertes", v)}
                    />
                    <div>
                      <Champ
                        libelle="Fermeture des inscriptions (facultatif)"
                        aide="Sans date, les inscriptions restent ouvertes jusqu'à ce que vous les fermiez."
                        type="datetime-local"
                        value={f.inscriptionsFermeLe}
                        onChange={(e) => maj("inscriptionsFermeLe", e.target.value)}
                      />
                      {f.inscriptionsFermeLe !== "" && (
                        <Bouton
                          variante="discret"
                          taille="s"
                          className="mt-1"
                          onClick={() => maj("inscriptionsFermeLe", "")}
                        >
                          Effacer la date
                        </Bouton>
                      )}
                    </div>
                  </fieldset>
                </Carte>

                {/* --- Options --- */}
                <Carte>
                  <fieldset disabled={fondVerrouille} className="space-y-4">
                    <legend className="mb-2 text-lg font-semibold text-slate-900">
                      Options
                    </legend>
                    <CaseACocher
                      libelle="Plein écran obligatoire"
                      coche={f.pleinEcranObligatoire}
                      onChange={(v) => maj("pleinEcranObligatoire", v)}
                    />
                    <CaseACocher
                      libelle="Détecter le changement d'onglet"
                      coche={f.detecterChangementOnglet}
                      onChange={(v) => maj("detecterChangementOnglet", v)}
                    />
                    <CaseACocher
                      libelle="Mélanger les questions et les réponses"
                      coche={f.melangerQuestions}
                      onChange={(v) => maj("melangerQuestions", v)}
                    />
                    <CaseACocher
                      libelle="Navigation libre"
                      aide="Décochée : une seule question à la fois."
                      coche={f.navigationLibre}
                      onChange={(v) => maj("navigationLibre", v)}
                    />
                    <CaseACocher
                      libelle="Retour en arrière autorisé"
                      coche={f.retourEnArriere}
                      onChange={(v) => maj("retourEnArriere", v)}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Champ
                        libelle="Tolérance de coupure (secondes)"
                        aide="Une coupure plus courte n'est pas notée."
                        type="number"
                        min={0}
                        max={600}
                        value={f.toleranceCoupureSecondes}
                        onChange={(e) => maj("toleranceCoupureSecondes", e.target.value)}
                      />
                      <Champ
                        libelle="Incidents graves avant exclusion"
                        aide="2 : avertissement au premier, exclusion au deuxième."
                        type="number"
                        min={1}
                        max={10}
                        value={f.seuilIncidentsGraves}
                        onChange={(e) => maj("seuilIncidentsGraves", e.target.value)}
                      />
                    </div>
                  </fieldset>
                </Carte>
              </>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Bouton type="submit" disabled={enCours}>
                {creation ? "Créer l'évaluation" : "Enregistrer"}
              </Bouton>
              {!creation &&
                detail &&
                detail.statut === "brouillon" &&
                detail.nombreInscriptions === 0 && (
                  <Bouton variante="danger" onClick={() => void supprimer()}>
                    Supprimer ce brouillon
                  </Bouton>
                )}
            </div>
          </form>

          {/* --- Planification, codes et lien : seulement pour une évaluation qui existe --- */}
          {!creation && detail && (
            <>
              {(detail.statut === "brouillon" || detail.statut === "planifiee") && (
                <Carte className="space-y-3">
                  <h2 className="text-lg font-semibold text-slate-900">Planification</h2>
                  {detail.statut === "brouillon" ? (
                    <>
                      <p className="text-sm text-slate-600">
                        Tant que l’évaluation est un brouillon, son lien ne fonctionne pas
                        pour les étudiants. Les vérifications portent sur les données
                        enregistrées : enregistrez vos modifications avant de planifier.
                      </p>
                      <ul className="space-y-1 text-sm">
                        {verifications.map((v) => (
                          <li
                            key={v.texte}
                            className={v.ok ? "text-marque-800" : "text-amber-800"}
                          >
                            {v.ok ? "✓" : "✗"} {v.texte}
                          </li>
                        ))}
                      </ul>
                      <Bouton
                        disabled={enCours || !toutEstPret}
                        onClick={() => void planifier()}
                      >
                        Planifier l’évaluation
                      </Bouton>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600">
                        L’évaluation est planifiée : les étudiants peuvent s’inscrire avec
                        le lien, et entrer avec le code d’accès pendant la plage horaire.
                        Vous pouvez encore la modifier tant qu’aucun étudiant n’est entré.
                      </p>
                      <Bouton
                        variante="secondaire"
                        disabled={enCours}
                        onClick={() => void repasserEnBrouillon()}
                      >
                        Repasser en brouillon
                      </Bouton>
                    </>
                  )}
                </Carte>
              )}

              <Carte className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Codes</h2>
                <BlocCode
                  titre="Code d'accès"
                  explication="Donné à voix haute aux étudiants validés, au début de l'évaluation."
                  defini={detail.codeAccesDefini}
                  modifiable={detail.modifiable}
                  onDefinir={(code) => definirCode("acces", code)}
                  onErreur={traiter}
                />
                <BlocCode
                  titre="Code de sortie"
                  explication="Donné par vous à un étudiant qui a terminé et veut quitter."
                  defini={detail.codeSortieDefini}
                  modifiable={detail.modifiable}
                  onDefinir={(code) => definirCode("sortie", code)}
                  onErreur={traiter}
                />
              </Carte>

              <Carte className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Lien à partager</h2>
                {detail.statut === "brouillon" && (
                  <Alerte type="attention">
                    Ce lien ne fonctionnera pour les étudiants qu’après la planification.
                  </Alerte>
                )}
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/e/${detail.lien}`}
                    onFocus={(ev) => ev.currentTarget.select()}
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm"
                  />
                  <Bouton variante="secondaire" onClick={() => void copierLien(detail.lien)}>
                    {lienCopie ? "Copié !" : "Copier"}
                  </Bouton>
                </div>
              </Carte>

              <Carte className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Questions</h2>
                <p className="text-sm text-slate-600">
                  {detail.nombreQuestions} question{detail.nombreQuestions > 1 ? "s" : ""}.
                </p>
                <Link
                  to={`/ecole/evaluations/${detail.id}/questions`}
                  className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {detail.modifiable ? "Gérer les questions" : "Voir les questions"}
                </Link>
              </Carte>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// La page : elle lit l'établissement actif et l'évaluation dans l'adresse. Le « key » donne
// un contenu tout neuf quand la personne change d'école ou d'évaluation.
export function PageFormulaireEvaluation() {
  const { etablissementActif } = useSession();
  const { id } = useParams<{ id: string }>();
  if (!etablissementActif) return null;

  return (
    <ContenuFormulaire
      key={`${etablissementActif.etablissementId}-${id ?? "nouvelle"}`}
      idEtablissement={etablissementActif.etablissementId}
      idEvaluation={id}
    />
  );
}