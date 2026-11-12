import { MigrationInterface, QueryRunner } from "typeorm";

export class AjouterIndexSession1794446801396 implements MigrationInterface {
    name = 'AjouterIndexSession1794446801396'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_0f9746fdc71ac794aacbe1919e\` ON \`participations\` (\`sessionId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_0f9746fdc71ac794aacbe1919e\` ON \`participations\``);
    }

}
