import { randomBytes } from 'node:crypto';
import { hasherCode } from '../common/codes';
import dataSource from './data-source';
import { Etablissement } from './entities/etablissement.entity';
import { Etudiant } from './entities/etudiant.entity';
import { Evaluation } from './entities/evaluation.entity';
import { Membre } from './entities/membre.entity';
import { Participation } from './entities/participation.entity';
import { Question } from './entities/question.entity';
import { Utilisateur } from './entities/utilisateur.entity';
import {
  RoleMembre,
  StatutEvaluation,
  StatutParticipation,
  TypeQuestion,
} from './enums';

// Script de DONNÉES DE TEST pour le développement (« npm run seed »).
// Il crée une évaluation prête à être passée par deux étudiants fictifs.

async function main() {
  // Sécurité : ce script ne doit JAMAIS tourner sur une vraie base de production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le script de test est interdit en production.');
  }

  // Connexion à MySQL (avec la configuration de data-source.ts).
  await dataSource.initialize();

  try {
    // Un « repository » = l'outil de TypeORM pour lire et écrire dans UNE table.
    const repoEtab = dataSource.getRepository(Etablissement);
    const repoUser = dataSource.getRepository(Utilisateur);
    const repoMembre = dataSource.getRepository(Membre);
    const repoEval = dataSource.getRepository(Evaluation);
    const repoQuestion = dataSource.getRepository(Question);
    const repoEtudiant = dataSource.getRepository(Etudiant);
    const repoParticipation = dataSource.getRepository(Participation);

    // 1. L'établissement de test (créé une seule fois, retrouvé ensuite).
    let etab = await repoEtab.findOneBy({ nom: 'École de test' });
    if (!etab) {
      etab = await repoEtab.save(
        repoEtab.create({ nom: 'École de test', ville: 'Dakar' }),
      );
    }

    // 2. L'enseignant de test.
    let prof = await repoUser.findOneBy({ emailGoogle: 'prof@test.com' });
    if (!prof) {
      prof = await repoUser.save(
        repoUser.create({
          emailGoogle: 'prof@test.com',
          nom: 'Diallo',
          prenom: 'Moussa',
          estSuperAdmin: false,
        }),
      );
    }

    // 3. Son rattachement à l'école (il y est enseignant).
    let membre = await repoMembre.findOneBy({
      utilisateurId: prof.id,
      etablissementId: etab.id,
    });
    if (!membre) {
      membre = await repoMembre.save(
        repoMembre.create({
          utilisateurId: prof.id,
          etablissementId: etab.id,
          role: RoleMembre.ENSEIGNANT,
        }),
      );
    }

        // Réglages facultatifs, donnés en minutes après la commande :
    //   npm run seed -- 5 2   =>  durée de 5 minutes, plage horaire de 2 minutes
    const dureeMinutes = Number(process.argv[2] ?? 10);
    const plageMinutes = Number(process.argv[3] ?? 360);
    if (!(dureeMinutes > 0) || !(plageMinutes > 0)) {
      throw new Error('La durée et la plage doivent être des nombres positifs.');
    }

    // 4. L'évaluation de test.
    // La plage horaire est large (de il y a 1 h à dans 6 h) pour laisser du temps aux essais.
    // La durée est courte (10 minutes) pour voir le chronomètre descendre vite.
    const maintenant = Date.now();
    const lien = randomBytes(8).toString('hex'); // 16 caractères aléatoires
    const evaluation = await repoEval.save(
      repoEval.create({
        etablissementId: etab.id,
        membreId: membre.id,
        titre: 'Contrôle de test',
        debut: new Date(maintenant - 60 * 60 * 1000),
        fin: new Date(maintenant + plageMinutes * 60 * 1000),
           dureeMinutes,
        statut: StatutEvaluation.PLANIFIEE,
        lien,
        // Les codes de test : accès « 1234 », sortie « 9999 » (stockés hachés).
        codeAccesHash: await hasherCode('1234'),
        codeSortieHash: await hasherCode('9999'),
      }),
    );

    // 5. Les 4 questions de test (20 points en tout).
    await repoQuestion.save(
      repoQuestion.create([
        {
          evaluationId: evaluation.id,
          ordre: 1,
          type: TypeQuestion.QCM_UNIQUE,
          enonce: 'Quelle est la capitale du Sénégal ?',
          points: 2,
          options: [
            { id: 'a', texte: 'Dakar', correcte: true },
            { id: 'b', texte: 'Thiès', correcte: false },
            { id: 'c', texte: 'Saint-Louis', correcte: false },
            { id: 'd', texte: 'Kaolack', correcte: false },
          ],
        },
        {
          evaluationId: evaluation.id,
          ordre: 2,
          type: TypeQuestion.QCM_MULTIPLE,
          enonce: 'Quels éléments sont des langages de programmation ?',
          points: 3,
          options: [
            { id: 'a', texte: 'JavaScript', correcte: true },
            { id: 'b', texte: 'HTML', correcte: false },
            { id: 'c', texte: 'Python', correcte: true },
            { id: 'd', texte: 'CSS', correcte: false },
          ],
        },
        {
          evaluationId: evaluation.id,
          ordre: 3,
          type: TypeQuestion.OUVERTE,
          enonce: 'Expliquez en deux phrases ce qu’est une base de données.',
          points: 5,
        },
        {
          evaluationId: evaluation.id,
          ordre: 4,
          type: TypeQuestion.CODE,
          enonce:
            'Écrivez une fonction carre(n) qui renvoie le carré d’un nombre.',
          points: 10,
          langage: 'javascript',
        },
      ]),
    );

    // 6. Deux étudiants fictifs, déjà VALIDÉS pour cette évaluation.
    const etudiantsTest = [
      { nom: 'Diop', prenom: 'Awa', email: 'awa@test.com' },
      { nom: 'Fall', prenom: 'Cheikh', email: 'cheikh@test.com' },
    ];
    for (const e of etudiantsTest) {
      // La fiche Etudiant de l'école (créée une seule fois).
      let etudiant = await repoEtudiant.findOneBy({
        etablissementId: etab.id,
        email: e.email,
      });
      if (!etudiant) {
        etudiant = await repoEtudiant.save(
          repoEtudiant.create({ etablissementId: etab.id, ...e }),
        );
      }
      // Sa participation à l'évaluation, déjà validée par l'enseignant.
      await repoParticipation.save(
        repoParticipation.create({
          evaluationId: evaluation.id,
          ...e,
          etudiantId: etudiant.id,
          statut: StatutParticipation.VALIDE,
        }),
      );
    }

    // On affiche ce dont on aura besoin pour les tests.
    console.log('--- Données de test créées ---');
    console.log('Lien de l’évaluation :', lien);
    console.log('Code d’accès : 1234   |   Code de sortie : 9999');
        console.log(`Durée : ${dureeMinutes} min | plage horaire : ${plageMinutes} min à partir de maintenant`);
    console.log('Étudiants validés : awa@test.com, cheikh@test.com');
  } finally {
    // Quoi qu'il arrive, on referme la connexion à la base.
    await dataSource.destroy();
  }
}

// On lance le script ; en cas d'erreur, on l'affiche et on sort avec un code d'échec.
main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});