import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membre } from '../database/entities/membre.entity';
import { Utilisateur } from '../database/entities/utilisateur.entity';
import { RoleMembre } from '../database/enums';
import { InviterEnseignantDto } from './dto/inviter-enseignant.dto';

// Les actions de l'administrateur d'école sur ses enseignants.
// IMPORTANT : chaque méthode reçoit « etablissementId » de la part du CONTRÔLEUR, qui l'a
// lui-même obtenu de la garde ContexteEtablissementGuard (donc vérifié). On ne lit jamais
// l'établissement dans les données envoyées par l'utilisateur.
@Injectable()
export class EnseignantsService {
  constructor(
    @InjectRepository(Utilisateur)
    private readonly utilisateurs: Repository<Utilisateur>,
    @InjectRepository(Membre)
    private readonly membres: Repository<Membre>,
  ) {}

  // LISTER les enseignants de l'établissement (accès retirés compris).
  async lister(etablissementId: string) {
    const enseignants = await this.membres.find({
      where: { etablissementId, role: RoleMembre.ENSEIGNANT },
      relations: { utilisateur: true },
      order: { creeLe: 'ASC' },
    });

    return enseignants.map((m) => ({
      membreId: m.id,
      nom: m.utilisateur.nom,
      prenom: m.utilisateur.prenom,
      email: m.utilisateur.emailGoogle,
      actif: m.actif,
      // Vrai dès que la personne s'est connectée une première fois avec Google.
      dejaConnecte: m.utilisateur.googleId !== null,
      ajouteLe: m.creeLe,
    }));
  }

  // INVITER un enseignant : on enregistre son adresse Google ; il pourra se connecter ensuite.
  async inviter(etablissementId: string, dto: InviterEnseignantDto) {
    const email = dto.email.trim().toLowerCase();

    // La personne existe peut-être déjà (par exemple enseignante dans une autre école) :
    // on garde alors son nom tel qu'il est.
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
      let message = 'Cette personne est déjà membre de cet établissement.';
      if (existant.role === RoleMembre.ENSEIGNANT) {
        message = existant.actif
          ? 'Cette personne est déjà enseignante de cet établissement.'
          : 'Cette personne est déjà enseignante ici, mais son accès a été retiré : rétablissez-le.';
      }
      throw new ConflictException(message);
    }

    const membre = await this.membres.save(
      this.membres.create({
        utilisateurId: utilisateur.id,
        etablissementId,
        role: RoleMembre.ENSEIGNANT,
      }),
    );
    return { membreId: membre.id, email, actif: true };
  }

  // RETIRER ou RÉTABLIR l'accès d'un enseignant.
  async changerAcces(etablissementId: string, membreId: string, actif: boolean) {
    // On cherche dans CET établissement seulement : l'identifiant d'un membre d'une autre
    // école donne « introuvable », même si ce membre existe bel et bien.
    const membre = await this.membres.findOneBy({
      id: membreId,
      etablissementId,
      role: RoleMembre.ENSEIGNANT, // un administrateur ne se retire pas par cette route
    });
    if (!membre) {
      throw new NotFoundException('Enseignant introuvable.');
    }

    membre.actif = actif;
    await this.membres.save(membre);
    return { membreId: membre.id, actif: membre.actif };
  }
}