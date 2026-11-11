import { MigrationInterface, QueryRunner } from "typeorm";

export class CreerEvaluations1794435298546 implements MigrationInterface {
    name = 'CreerEvaluations1794435298546'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`evaluations\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`etablissementId\` varchar(255) NOT NULL, \`membreId\` varchar(255) NOT NULL, \`titre\` varchar(200) NOT NULL, \`debut\` datetime NOT NULL, \`fin\` datetime NOT NULL, \`dureeMinutes\` int NOT NULL, \`statut\` enum ('brouillon', 'planifiee', 'en_cours', 'terminee', 'corrigee', 'publiee') NOT NULL DEFAULT 'brouillon', \`lien\` varchar(40) NOT NULL, \`codeAccesHash\` varchar(100) NULL, \`codeSortieHash\` varchar(100) NULL, \`inscriptionsOuvertes\` tinyint NOT NULL DEFAULT 0, \`inscriptionsFermeLe\` datetime NULL, \`pleinEcranObligatoire\` tinyint NOT NULL DEFAULT 1, \`detecterChangementOnglet\` tinyint NOT NULL DEFAULT 1, \`melangerQuestions\` tinyint NOT NULL DEFAULT 0, \`navigationLibre\` tinyint NOT NULL DEFAULT 1, \`retourEnArriere\` tinyint NOT NULL DEFAULT 1, \`toleranceCoupureSecondes\` int NOT NULL DEFAULT '60', \`seuilIncidentsGraves\` int NOT NULL DEFAULT '2', UNIQUE INDEX \`IDX_aea70ff93cebcb67a2820cbac3\` (\`lien\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`participations\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`evaluationId\` varchar(255) NOT NULL, \`nom\` varchar(100) NOT NULL, \`prenom\` varchar(100) NOT NULL, \`email\` varchar(255) NOT NULL, \`classeId\` varchar(255) NULL, \`etudiantId\` varchar(255) NULL, \`statut\` enum ('en_attente', 'refuse', 'valide', 'en_cours', 'exclu', 'termine') NOT NULL DEFAULT 'en_attente', \`debutAt\` datetime NULL, \`finPrevueAt\` datetime NULL, \`tempsSupplementaireSecondes\` int NOT NULL DEFAULT '0', \`sessionId\` varchar(64) NULL, \`derniereActiviteAt\` datetime NULL, \`nbIncidentsGraves\` int NOT NULL DEFAULT '0', \`noteTotale\` decimal(6,2) NULL, \`corrigee\` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX \`IDX_1db24bed3bcea098af349acd5e\` (\`evaluationId\`, \`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`envois_notes\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`participationId\` varchar(255) NOT NULL, \`statut\` enum ('envoye', 'echec') NOT NULL, \`erreur\` text NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`incidents\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`participationId\` varchar(255) NOT NULL, \`type\` enum ('sortie_plein_ecran', 'changement_onglet', 'coupure', 'reconnexion', 'exclusion', 'reintegration') NOT NULL, \`gravite\` enum ('grave', 'information') NOT NULL, \`details\` varchar(255) NULL, INDEX \`IDX_2f7c1b709eab2629cbf4309441\` (\`participationId\`, \`creeLe\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`questions\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`evaluationId\` varchar(255) NOT NULL, \`ordre\` int NOT NULL, \`type\` enum ('qcm_unique', 'qcm_multiple', 'reponse_courte', 'ouverte', 'code') NOT NULL, \`enonce\` text NOT NULL, \`points\` decimal(5,2) NOT NULL, \`langage\` varchar(30) NULL, \`options\` json NULL, INDEX \`IDX_5cfcd95d0d9083b002bc44ceac\` (\`evaluationId\`, \`ordre\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`reponses\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`participationId\` varchar(255) NOT NULL, \`questionId\` varchar(255) NOT NULL, \`contenu\` json NULL, \`version\` int NOT NULL DEFAULT '0', \`note\` decimal(5,2) NULL, \`commentaire\` text NULL, UNIQUE INDEX \`IDX_dbb68acc22798a3b542503c406\` (\`participationId\`, \`questionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`evaluations_classes\` (\`evaluationsId\` varchar(36) NOT NULL, \`classesId\` varchar(36) NOT NULL, INDEX \`IDX_05961670ef23332af04151f305\` (\`evaluationsId\`), INDEX \`IDX_7b08ed8b5fcf944fa5df1b23cd\` (\`classesId\`), PRIMARY KEY (\`evaluationsId\`, \`classesId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`evaluations\` ADD CONSTRAINT \`FK_5e766732a9cb8336c02e5acc913\` FOREIGN KEY (\`etablissementId\`) REFERENCES \`etablissements\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`evaluations\` ADD CONSTRAINT \`FK_8fa0f2ceed3d038e4132503e829\` FOREIGN KEY (\`membreId\`) REFERENCES \`membres\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`participations\` ADD CONSTRAINT \`FK_46bf233a1582eb63c98cee1ba9f\` FOREIGN KEY (\`evaluationId\`) REFERENCES \`evaluations\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`participations\` ADD CONSTRAINT \`FK_2f0a34dd9ea705b7912805b79b8\` FOREIGN KEY (\`classeId\`) REFERENCES \`classes\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`participations\` ADD CONSTRAINT \`FK_2206c91aa940a0be90fed754e54\` FOREIGN KEY (\`etudiantId\`) REFERENCES \`etudiants\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`envois_notes\` ADD CONSTRAINT \`FK_af5af1a347dd83bb2f8f7c52523\` FOREIGN KEY (\`participationId\`) REFERENCES \`participations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`incidents\` ADD CONSTRAINT \`FK_60dbe10308a4d733c6f1a99a6ab\` FOREIGN KEY (\`participationId\`) REFERENCES \`participations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`questions\` ADD CONSTRAINT \`FK_dca2adbccaedc612a69ea3cc6aa\` FOREIGN KEY (\`evaluationId\`) REFERENCES \`evaluations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`reponses\` ADD CONSTRAINT \`FK_951b602b7cc99f8d588a0c4da25\` FOREIGN KEY (\`participationId\`) REFERENCES \`participations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`reponses\` ADD CONSTRAINT \`FK_5bc954d6294a714797f8dbcfa02\` FOREIGN KEY (\`questionId\`) REFERENCES \`questions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`evaluations_classes\` ADD CONSTRAINT \`FK_05961670ef23332af04151f3052\` FOREIGN KEY (\`evaluationsId\`) REFERENCES \`evaluations\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`evaluations_classes\` ADD CONSTRAINT \`FK_7b08ed8b5fcf944fa5df1b23cd1\` FOREIGN KEY (\`classesId\`) REFERENCES \`classes\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`evaluations_classes\` DROP FOREIGN KEY \`FK_7b08ed8b5fcf944fa5df1b23cd1\``);
        await queryRunner.query(`ALTER TABLE \`evaluations_classes\` DROP FOREIGN KEY \`FK_05961670ef23332af04151f3052\``);
        await queryRunner.query(`ALTER TABLE \`reponses\` DROP FOREIGN KEY \`FK_5bc954d6294a714797f8dbcfa02\``);
        await queryRunner.query(`ALTER TABLE \`reponses\` DROP FOREIGN KEY \`FK_951b602b7cc99f8d588a0c4da25\``);
        await queryRunner.query(`ALTER TABLE \`questions\` DROP FOREIGN KEY \`FK_dca2adbccaedc612a69ea3cc6aa\``);
        await queryRunner.query(`ALTER TABLE \`incidents\` DROP FOREIGN KEY \`FK_60dbe10308a4d733c6f1a99a6ab\``);
        await queryRunner.query(`ALTER TABLE \`envois_notes\` DROP FOREIGN KEY \`FK_af5af1a347dd83bb2f8f7c52523\``);
        await queryRunner.query(`ALTER TABLE \`participations\` DROP FOREIGN KEY \`FK_2206c91aa940a0be90fed754e54\``);
        await queryRunner.query(`ALTER TABLE \`participations\` DROP FOREIGN KEY \`FK_2f0a34dd9ea705b7912805b79b8\``);
        await queryRunner.query(`ALTER TABLE \`participations\` DROP FOREIGN KEY \`FK_46bf233a1582eb63c98cee1ba9f\``);
        await queryRunner.query(`ALTER TABLE \`evaluations\` DROP FOREIGN KEY \`FK_8fa0f2ceed3d038e4132503e829\``);
        await queryRunner.query(`ALTER TABLE \`evaluations\` DROP FOREIGN KEY \`FK_5e766732a9cb8336c02e5acc913\``);
        await queryRunner.query(`DROP INDEX \`IDX_7b08ed8b5fcf944fa5df1b23cd\` ON \`evaluations_classes\``);
        await queryRunner.query(`DROP INDEX \`IDX_05961670ef23332af04151f305\` ON \`evaluations_classes\``);
        await queryRunner.query(`DROP TABLE \`evaluations_classes\``);
        await queryRunner.query(`DROP INDEX \`IDX_dbb68acc22798a3b542503c406\` ON \`reponses\``);
        await queryRunner.query(`DROP TABLE \`reponses\``);
        await queryRunner.query(`DROP INDEX \`IDX_5cfcd95d0d9083b002bc44ceac\` ON \`questions\``);
        await queryRunner.query(`DROP TABLE \`questions\``);
        await queryRunner.query(`DROP INDEX \`IDX_2f7c1b709eab2629cbf4309441\` ON \`incidents\``);
        await queryRunner.query(`DROP TABLE \`incidents\``);
        await queryRunner.query(`DROP TABLE \`envois_notes\``);
        await queryRunner.query(`DROP INDEX \`IDX_1db24bed3bcea098af349acd5e\` ON \`participations\``);
        await queryRunner.query(`DROP TABLE \`participations\``);
        await queryRunner.query(`DROP INDEX \`IDX_aea70ff93cebcb67a2820cbac3\` ON \`evaluations\``);
        await queryRunner.query(`DROP TABLE \`evaluations\``);
    }

}
