import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Etablissement } from '../database/entities/etablissement.entity';
import { Membre } from '../database/entities/membre.entity';
import { Utilisateur } from '../database/entities/utilisateur.entity';
import { RoleMembre, StatutEtablissement } from '../database/enums';
import { AjouterAdminDto } from './dto/ajouter-admin.dto';
import { CreerEtablissementDto } from './dto/creer-etablissement.dto';

// Les actions du super-administrateur sur les établissements.
@Injectable()
export class EtablissementsService {
  constructor(
    @InjectRepository(Etablissement)
    private readonly etablissements: Repository<Etablissement>,
    @InjectRepository(Utilisateur)
    private readonly utilisateurs: Repository<Utilisateur>,
    @InjectRepository(Membre)
    private readonly membres: Repository<Membre>,
  ) {}

  // LISTER : tous les établissements, avec leurs administrateurs.
  async lister() {
    const liste = await this.etablissements.find({
      order: { creeLe: 'DESC' },
    });
    // Tous les administrateurs de tous les établissements, en une seule requête.
    const admins = await this.membres.find({
      where: { role: RoleMembre.ADMIN },
      relations: { utilisateur: true },
    });

    return liste.map((e) => ({
      id: e.id,
      nom: e.nom,
      ville: e.ville,
      statut: e.statut,
      creeLe: e.creeLe,
      administrateurs: admins
        .filter((m) => m.etablissementId === e.id)
        .map((m) => ({
          nom: m.utilisateur.nom,
          prenom: m.utilisateur.prenom,
          email: m.utilisateur.emailGoogle,
        })),
    }));
  }

  // CRÉER un établissement (actif par défaut).
  async creer(dto: CreerEtablissementDto) {
    const nom = dto.nom.trim();

    // Deux établissements ne peuvent pas porter le même nom (majuscules ignorées par MySQL).
    const existant = await this.etablissements.findOneBy({ nom });
    if (existant) {
      throw new ConflictException('Un établissement porte déjà ce nom.');
    }

    const cree = await this.etablissements.save(
      this.etablissements.create({ nom, ville: dto.ville?.trim() || null }),
    );
    // On relit la ligne : elle contient maintenant les valeurs par défaut (statut « actif »).
    return this.etablissements.findOneByOrFail({ id: cree.id });
  }

  // NOMMER l'administrateur d'un établissement.
  async ajouterAdministrateur(etablissementId: string, dto: AjouterAdminDto) {
    const etablissement = await this.etablissements.findOneBy({
      id: etablissementId,
    });
    if (!etablissement) {
      throw new NotFoundException('Établissement introuvable.');
    }

    const email = dto.email.trim().toLowerCase();

    // La personne existe peut-être déjà (par exemple enseignante dans une autre école).
    let utilisateur = await this.utilisateurs.findOneBy({ emailGoogle: email });
    if (!utilisateur) {
      utilisateur = await this.utilisateurs.save(
        this.utilisateurs.create({
          emailGoogle: email,
          nom: dto.nom.trim(),
          prenom: dto.prenom.trim(),
          estSuperAdmin: false,
        }),
      );
    }

    // Une personne n'a qu'UN rôle par établissement.
    const existant = await this.membres.findOneBy({
      utilisateurId: utilisateur.id,
      etablissementId,
    });
    if (existant) {
      throw new ConflictException(
        existant.role === RoleMembre.ADMIN
          ? 'Cette personne est déjà administratrice de cet établissement.'
          : 'Cette personne est déjà membre de cet établissement avec un autre rôle.',
      );
    }

    await this.membres.save(
      this.membres.create({
        utilisateurId: utilisateur.id,
        etablissementId,
        role: RoleMembre.ADMIN,
      }),
    );
    return { utilisateurId: utilisateur.id, email, role: RoleMembre.ADMIN };
  }

  // INTERRUPTEUR : active ou désactive un établissement.
  async changerStatut(id: string, statut: StatutEtablissement) {
    const etablissement = await this.etablissements.findOneBy({ id });
    if (!etablissement) {
      throw new NotFoundException('Établissement introuvable.');
    }
    etablissement.statut = statut;
    return this.etablissements.save(etablissement);
  }
}