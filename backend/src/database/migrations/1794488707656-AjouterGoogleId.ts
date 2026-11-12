import { MigrationInterface, QueryRunner } from "typeorm";

export class AjouterGoogleId1794488707656 implements MigrationInterface {
    name = 'AjouterGoogleId1794488707656'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`utilisateurs\` ADD \`googleId\` varchar(64) NULL`);
        await queryRunner.query(`ALTER TABLE \`utilisateurs\` ADD UNIQUE INDEX \`IDX_2ac054a5c553041bc4494daa48\` (\`googleId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`utilisateurs\` DROP INDEX \`IDX_2ac054a5c553041bc4494daa48\``);
        await queryRunner.query(`ALTER TABLE \`utilisateurs\` DROP COLUMN \`googleId\``);
    }

}
