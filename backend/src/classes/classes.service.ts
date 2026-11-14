import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Classe } from '../database/entities/classe.entity';
import { Etudiant } from '../database/entities/etudiant.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { analyserListe } from './analyse-liste';
import { AjouterEtudiantDto } from './dto/ajouter-etudiant.dto';
import { ClasseDto } from './dto/classe.dto';

// Les actions sur les classes et leurs étudiants.
// IMPORTANT : chaque méthode reçoit « etablissementId » du CONTRÔLEUR, qui l'a obtenu de la
// garde ContexteEtablissementGuard (donc vérifié). Toutes les recherches sont limitées à
// cet établissement : l'identifiant d'une classe d'une autre école donne « introuvable ».
@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Classe)
    private readonly classes: Repository<Classe>,
    @InjectRepository(Etudiant)
    private readonly etudiants: Repository<Etudiant>,
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
  ) {}

  // ---------------------------------------------------------------------------
  // LES CLASSES
  // ---------------------------------------------------------------------------

  // LISTER les classes de l'établissement, avec le nombre d'étudiants de chacune.
  async lister(etablissementId: string) {
  // 1. Récupérer les classes de l'établissement
  const liste = await this.classes
    .createQueryBuilder('c')
    .where('c.etablissementId = :etablissementId', { etablissementId })
    .orderBy('c.nom', 'ASC')
    .getMany();

  if (liste.length === 0) {
    return [];
  }

  // 2. Compter les étudiants de chaque classe
  const comptes = await this.classes
    .createQueryBuilder('c')
    .leftJoin('c.etudiants', 'e')
    .select('c.id', 'classeId')
    .addSelect('COUNT(e.id)', 'nbEtudiants')
    .where('c.etablissementId = :etablissementId', { etablissementId })
    .groupBy('c.id')
    .getRawMany<{
      classeId: string;
      nbEtudiants: string | number;
    }>();

  // 3. Associer chaque classe à son nombre d'étudiants
  const compteParClasse = new Map(
    comptes.map((item) => [
      item.classeId,
      Number(item.nbEtudiants),
    ]),
  );

  return liste.map((classe) =>
    Object.assign(classe, {
      nbEtudiants: compteParClasse.get(classe.id) ?? 0,
    }),
  );
}

  // CRÉER une classe.
  async creer(etablissementId: string, dto: ClasseDto) {
    const nom = dto.nom.trim();
    await this.verifierNomLibre(etablissementId, nom);

    const classe = await this.classes.save(
      this.classes.create({ etablissementId, nom }),
    );
    return { id: classe.id, nom: classe.nom };
  }

  // RENOMMER une classe.
  async renommer(etablissementId: string, id: string, dto: ClasseDto) {
    const classe = await this.trouverClasse(etablissementId, id);
    const nom = dto.nom.trim();
    await this.verifierNomLibre(etablissementId, nom, classe.id);

    classe.nom = nom;
    await this.classes.save(classe);
    return { id: classe.id, nom: classe.nom };
  }

  // SUPPRIMER une classe, sauf si une évaluation y est rattachée.
  async supprimer(etablissementId: string, id: string) {
    const classe = await this.trouverClasse(etablissementId, id);

    const rattachees = await this.evaluations
      .createQueryBuilder('e')
      .innerJoin('e.classes', 'c', 'c.id = :id', { id: classe.id })
      .getCount();
    if (rattachees > 0) {
      throw new ConflictException(
        'Cette classe est rattachée à au moins une évaluation : elle ne peut pas être supprimée.',
      );
    }

    // Les liens avec les étudiants disparaissent avec la classe (les étudiants, eux, restent).
    await this.classes.remove(classe);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // LES ÉTUDIANTS D'UNE CLASSE
  // ---------------------------------------------------------------------------

  // LISTER les étudiants d'une classe, par ordre alphabétique.
  async etudiantsDeLaClasse(etablissementId: string, id: string) {
    const classe = await this.trouverClasse(etablissementId, id, true);
    return classe.etudiants
      .map((e) => ({ id: e.id, nom: e.nom, prenom: e.prenom, email: e.email }))
      .sort(
        (a, b) =>
          a.nom.localeCompare(b.nom, 'fr') ||
          a.prenom.localeCompare(b.prenom, 'fr'),
      );
  }

  // AJOUTER un étudiant à une classe. S'il existe déjà dans l'établissement (même e-mail),
  // on le réutilise au lieu d'en créer un second.
  async ajouterEtudiant(
    etablissementId: string,
    id: string,
    dto: AjouterEtudiantDto,
  ) {
    const classe = await this.trouverClasse(etablissementId, id, true);
    const email = dto.email.trim().toLowerCase();

    let etudiant = await this.etudiants.findOneBy({ etablissementId, email });
    if (!etudiant) {
      etudiant = await this.etudiants.save(
        this.etudiants.create({
          etablissementId,
          nom: dto.nom.trim(),
          prenom: dto.prenom.trim(),
          email,
        }),
      );
    }

    if (classe.etudiants.some((e) => e.id === etudiant.id)) {
      throw new ConflictException('Cet étudiant est déjà dans la classe.');
    }

    classe.etudiants.push(etudiant);
    await this.classes.save(classe);
    return {
      id: etudiant.id,
      nom: etudiant.nom,
      prenom: etudiant.prenom,
      email: etudiant.email,
    };
  }

  // RETIRER un étudiant d'une classe (la fiche de l'étudiant est conservée).
  async retirerEtudiant(
    etablissementId: string,
    id: string,
    etudiantId: string,
  ) {
    const classe = await this.trouverClasse(etablissementId, id, true);
    if (!classe.etudiants.some((e) => e.id === etudiantId)) {
      throw new NotFoundException('Cet étudiant n’est pas dans cette classe.');
    }

    classe.etudiants = classe.etudiants.filter((e) => e.id !== etudiantId);
    await this.classes.save(classe);
    return { ok: true };
  }

  // IMPORTER une liste collée.
  //  - confirmer absent ou faux : on ANALYSE seulement (aperçu), rien n'est écrit ;
  //  - confirmer vrai : on enregistre les lignes valides.
  async importer(
    etablissementId: string,
    id: string,
    texte: string,
    confirmer: boolean,
  ) {
    const classe = await this.trouverClasse(etablissementId, id, true);
    const { valides, erreurs, lignesLues } = analyserListe(texte);

    // Parmi les lignes valides, lesquelles existent déjà comme étudiants de l'établissement ?
    const emails = valides.map((v) => v.email);
    const existants =
      emails.length > 0
        ? await this.etudiants.find({
            where: { etablissementId, email: In(emails) },
          })
        : [];
    const existantParEmail = new Map(
      existants.map((e) => [e.email.toLowerCase(), e]),
    );
    const dansLaClasse = new Set(classe.etudiants.map((e) => e.email.toLowerCase()));

    const aCreer: typeof valides = []; // inconnus de l'établissement : on les crée
    const aRattacher: Etudiant[] = []; // connus de l'établissement : on les ajoute à la classe
    let dejaPresents = 0; // déjà dans la classe : rien à faire
    for (const ligne of valides) {
      if (dansLaClasse.has(ligne.email)) {
        dejaPresents++;
      } else {
        const connu = existantParEmail.get(ligne.email);
        if (connu) aRattacher.push(connu);
        else aCreer.push(ligne);
      }
    }

    // Le résumé affiché à l'enseignant : « 3 reconnus, 2 erreurs... ».
    const resume = {
      lignesLues,
      reconnus: valides.length,
      nouveaux: aCreer.length,
      dejaConnusAjoutes: aRattacher.length,
      dejaDansLaClasse: dejaPresents,
      erreurs,
    };

    // Aperçu seulement : on s'arrête ici, sans rien écrire.
    if (!confirmer) return { confirme: false, ...resume };

    // Enregistrement, en UNE seule opération : tout réussit ou rien n'est enregistré.
    try {
      await this.etudiants.manager.transaction(async (gestionnaire) => {
        const crees =
          aCreer.length > 0
            ? await gestionnaire.save(
                Etudiant,
                aCreer.map((l) =>
                  gestionnaire.create(Etudiant, {
                    etablissementId,
                    nom: l.nom,
                    prenom: l.prenom,
                    email: l.email,
                  }),
                ),
              )
            : [];
        classe.etudiants = [...classe.etudiants, ...aRattacher, ...crees];
        await gestionnaire.save(Classe, classe);
      });
    } catch (erreur) {
      // Deux imports lancés en même temps : l'index unique a refusé le doublon.
      if (this.estDoublon(erreur)) {
        throw new ConflictException(
          'Un autre import est en cours pour cette école : réessayez dans un instant.',
        );
      }
      throw erreur;
    }
    return { confirme: true, ...resume };
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Retrouve une classe DE CET ÉTABLISSEMENT (avec ses étudiants si demandé).
  private async trouverClasse(
    etablissementId: string,
    id: string,
    avecEtudiants = false,
  ): Promise<Classe> {
    const classe = await this.classes.findOne({
      where: { id, etablissementId },
      relations: avecEtudiants ? { etudiants: true } : {},
    });
    if (!classe) throw new NotFoundException('Classe introuvable.');
    return classe;
  }

  // Deux classes d'une même école ne peuvent pas porter le même nom.
  private async verifierNomLibre(
    etablissementId: string,
    nom: string,
    sauf?: string,
  ): Promise<void> {
    const existante = await this.classes.findOneBy({ etablissementId, nom });
    if (existante && existante.id !== sauf) {
      throw new ConflictException('Une classe porte déjà ce nom.');
    }
  }

  // Reconnaît l'erreur MySQL « entrée en double » (index unique violé).
  private estDoublon(erreur: unknown): boolean {
    const code = (erreur as { driverError?: { code?: string } })?.driverError
      ?.code;
    return code === 'ER_DUP_ENTRY';
  }
}