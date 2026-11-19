import { Link } from 'react-router';
import { Alerte } from '../ui/Alerte';
import { Badge } from '../ui/Badge';
import { Bouton } from '../ui/Bouton';
import { classesBouton } from '../components/bouton.styles';
import { Carte } from '../ui/Carte';
import { Champ } from '../ui/Champ';
import { Logo } from '../ui/Logo';

// Les nuances de la marque (noms écrits en entier pour que Tailwind les repère).
const NUANCES = [
  'bg-marque-50',
  'bg-marque-100',
  'bg-marque-200',
  'bg-marque-300',
  'bg-marque-400',
  'bg-marque-500',
  'bg-marque-600',
  'bg-marque-700',
  'bg-marque-800',
  'bg-marque-900',
  'bg-marque-950',
];

// Page de DÉVELOPPEMENT : la galerie de style. Elle n'existe qu'en mode développement.
export function PageDesign() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Logo taille={40} />
        <h1 className="text-2xl font-bold">Galerie de style de sen-evalu</h1>
      </div>

      <Carte>
        <h2 className="mb-3 font-semibold">Couleurs de la marque</h2>
        <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
          {NUANCES.map((classe) => (
            <div key={classe} className={`h-12 flex-1 ${classe}`} title={classe} />
          ))}
        </div>
      </Carte>

      <Carte className="space-y-3">
        <h2 className="font-semibold">Boutons</h2>
        <div className="flex flex-wrap gap-3">
          <Bouton>Principal</Bouton>
          <Bouton variante="secondaire">Secondaire</Bouton>
          <Bouton variante="danger">Danger</Bouton>
          <Bouton variante="discret">Discret</Bouton>
          <Bouton disabled>Désactivé</Bouton>
          <Bouton taille="s">Petit</Bouton>
          <Link to="/" className={classesBouton('primaire')}>
            Un lien en bouton
          </Link>
        </div>
      </Carte>

      <Carte className="space-y-3">
        <h2 className="font-semibold">Étiquettes</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Brouillon</Badge>
          <Badge ton="succes">Validée</Badge>
          <Badge ton="attention">En attente</Badge>
          <Badge ton="danger">Refusée</Badge>
          <Badge ton="info">En cours</Badge>
        </div>
      </Carte>

      <Carte className="space-y-3">
        <h2 className="font-semibold">Messages</h2>
        <Alerte type="succes">Étudiant ajouté.</Alerte>
        <Alerte type="info">Cet écran se met à jour tout seul.</Alerte>
        <Alerte type="attention">Les inscriptions ferment dans une heure.</Alerte>
        <Alerte type="erreur">Une classe porte déjà ce nom.</Alerte>
      </Carte>

      <Carte className="space-y-4">
        <h2 className="font-semibold">Champs</h2>
        <Champ libelle="Titre de l’évaluation" placeholder="Exemple : Contrôle 1" />
        <Champ
          libelle="Durée (en minutes)"
          type="number"
          defaultValue={90}
          aide="Le chronomètre démarre à l’entrée de chaque étudiant."
        />
      </Carte>
    </div>
  );
}