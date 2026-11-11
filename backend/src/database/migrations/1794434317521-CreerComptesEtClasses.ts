import { MigrationInterface, QueryRunner } from "typeorm";

export class CreerComptesEtClasses1794434317521 implements MigrationInterface {
    name = 'CreerComptesEtClasses1794434317521'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`etablissements\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`nom\` varchar(150) NOT NULL, \`ville\` varchar(100) NULL, \`statut\` enum ('actif', 'inactif') NOT NULL DEFAULT 'actif', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`etudiants\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`etablissementId\` varchar(255) NOT NULL, \`nom\` varchar(100) NOT NULL, \`prenom\` varchar(100) NOT NULL, \`email\` varchar(255) NOT NULL, UNIQUE INDEX \`IDX_0b6b8d4c17c3231e5eeb6e0a28\` (\`etablissementId\`, \`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`classes\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`etablissementId\` varchar(255) NOT NULL, \`nom\` varchar(100) NOT NULL, UNIQUE INDEX \`IDX_c96fd2aa812559bf34430a46cb\` (\`etablissementId\`, \`nom\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`utilisateurs\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`emailGoogle\` varchar(255) NOT NULL, \`nom\` varchar(100) NOT NULL, \`prenom\` varchar(100) NOT NULL, \`estSuperAdmin\` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX \`IDX_7a144e52e046b1788d8c3c8fbb\` (\`emailGoogle\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`membres\` (\`id\` varchar(36) NOT NULL, \`creeLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modifieLe\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`utilisateurId\` varchar(255) NOT NULL, \`etablissementId\` varchar(255) NOT NULL, \`role\` enum ('admin', 'enseignant') NOT NULL, UNIQUE INDEX \`IDX_918d58f571bb99081fdc91f032\` (\`utilisateurId\`, \`etablissementId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`classes_etudiants\` (\`classesId\` varchar(36) NOT NULL, \`etudiantsId\` varchar(36) NOT NULL, INDEX \`IDX_8ae07a846019aa1a845df165d4\` (\`classesId\`), INDEX \`IDX_41206dd5bb0e13d96dd31272e1\` (\`etudiantsId\`), PRIMARY KEY (\`classesId\`, \`etudiantsId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`etudiants\` ADD CONSTRAINT \`FK_507c1ae414ee39de3ec796b8b53\` FOREIGN KEY (\`etablissementId\`) REFERENCES \`etablissements\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`classes\` ADD CONSTRAINT \`FK_797bc19cb72508cf9ff1d777599\` FOREIGN KEY (\`etablissementId\`) REFERENCES \`etablissements\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`membres\` ADD CONSTRAINT \`FK_8671f04eff6b981ea3d52a8391d\` FOREIGN KEY (\`utilisateurId\`) REFERENCES \`utilisateurs\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`membres\` ADD CONSTRAINT \`FK_3e02a04e83e50249f4fcb1d86f4\` FOREIGN KEY (\`etablissementId\`) REFERENCES \`etablissements\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`classes_etudiants\` ADD CONSTRAINT \`FK_8ae07a846019aa1a845df165d4d\` FOREIGN KEY (\`classesId\`) REFERENCES \`classes\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`classes_etudiants\` ADD CONSTRAINT \`FK_41206dd5bb0e13d96dd31272e15\` FOREIGN KEY (\`etudiantsId\`) REFERENCES \`etudiants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`classes_etudiants\` DROP FOREIGN KEY \`FK_41206dd5bb0e13d96dd31272e15\``);
        await queryRunner.query(`ALTER TABLE \`classes_etudiants\` DROP FOREIGN KEY \`FK_8ae07a846019aa1a845df165d4d\``);
        await queryRunner.query(`ALTER TABLE \`membres\` DROP FOREIGN KEY \`FK_3e02a04e83e50249f4fcb1d86f4\``);
        await queryRunner.query(`ALTER TABLE \`membres\` DROP FOREIGN KEY \`FK_8671f04eff6b981ea3d52a8391d\``);
        await queryRunner.query(`ALTER TABLE \`classes\` DROP FOREIGN KEY \`FK_797bc19cb72508cf9ff1d777599\``);
        await queryRunner.query(`ALTER TABLE \`etudiants\` DROP FOREIGN KEY \`FK_507c1ae414ee39de3ec796b8b53\``);
        await queryRunner.query(`DROP INDEX \`IDX_41206dd5bb0e13d96dd31272e1\` ON \`classes_etudiants\``);
        await queryRunner.query(`DROP INDEX \`IDX_8ae07a846019aa1a845df165d4\` ON \`classes_etudiants\``);
        await queryRunner.query(`DROP TABLE \`classes_etudiants\``);
        await queryRunner.query(`DROP INDEX \`IDX_918d58f571bb99081fdc91f032\` ON \`membres\``);
        await queryRunner.query(`DROP TABLE \`membres\``);
        await queryRunner.query(`DROP INDEX \`IDX_7a144e52e046b1788d8c3c8fbb\` ON \`utilisateurs\``);
        await queryRunner.query(`DROP TABLE \`utilisateurs\``);
        await queryRunner.query(`DROP INDEX \`IDX_c96fd2aa812559bf34430a46cb\` ON \`classes\``);
        await queryRunner.query(`DROP TABLE \`classes\``);
        await queryRunner.query(`DROP INDEX \`IDX_0b6b8d4c17c3231e5eeb6e0a28\` ON \`etudiants\``);
        await queryRunner.query(`DROP TABLE \`etudiants\``);
        await queryRunner.query(`DROP TABLE \`etablissements\``);
    }

}
