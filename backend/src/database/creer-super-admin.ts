import dataSource from './data-source';
import { Utilisateur } from './entities/utilisateur.entity';

// Commande qui fait d'une adresse Google le SUPER-ADMINISTRATEUR (vous).
// À lancer UNE fois : npm run super-admin -- votre@gmail.com "Nom" "Prénom"
// Elle crée le compte s'il n'existe pas, ou le promeut s'il existe déjà.

async function main() {
  const [email, nom, prenom] = process.argv.slice(2);
  if (!email || !nom || !prenom) {
    console.error('Usage : npm run super-admin -- adresse@gmail.com "Nom" "Prénom"');
    process.exit(1);
  }

  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(Utilisateur);
    const adresse = email.trim().toLowerCase();

    const existant = await repo.findOneBy({ emailGoogle: adresse });
    if (existant) {
      existant.estSuperAdmin = true;
      await repo.save(existant);
      console.log(`Compte existant promu super-administrateur : ${adresse}`);
    } else {
      await repo.save(
        repo.create({
          emailGoogle: adresse,
          nom: nom.trim(),
          prenom: prenom.trim(),
          estSuperAdmin: true,
        }),
      );
      console.log(`Super-administrateur créé : ${adresse}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});