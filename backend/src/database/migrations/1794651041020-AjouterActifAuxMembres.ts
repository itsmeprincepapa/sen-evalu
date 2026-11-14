import { MigrationInterface, QueryRunner } from "typeorm";

export class AjouterActifAuxMembres1794651041020 implements MigrationInterface {
    name = 'AjouterActifAuxMembres1794651041020'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`membres\` ADD \`actif\` tinyint NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`membres\` DROP COLUMN \`actif\``);
    }

}
