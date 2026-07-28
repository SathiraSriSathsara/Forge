# Gitea Webhook Database Update

The project does not currently configure Sequelize migrations. Do not rely on
`sequelize.sync()` to update an existing database: it creates the new fields
for a fresh database, but it does not safely populate existing `Repo` rows.

Back up the database before running these statements. Run each stage
individually and inspect its result before continuing.

## Stage 1: Add nullable columns

```sql
ALTER TABLE `Repo`
  ADD COLUMN `tocken_id` INT NULL,
  ADD COLUMN `webhook_secret` VARCHAR(255) NULL;
```

## Stage 2: Backfill existing repositories

Each repository needs an existing Gitea credential and its own strong webhook
secret. Generate secrets outside SQL, then update rows individually:

```sql
UPDATE `Repo`
SET
  `tocken_id` = 1,
  `webhook_secret` = 'replace-with-a-unique-secret-of-at-least-32-characters'
WHERE `id` = 1;
```

Repeat for every existing row. Do not reuse production secrets unnecessarily.
Every `tocken_id` must refer to an existing row in `Tocken`.

Verify the backfill:

```sql
SELECT
  r.`id`,
  r.`repo_name`,
  r.`tocken_id`,
  CHAR_LENGTH(r.`webhook_secret`) AS `secret_length`
FROM `Repo` AS r
LEFT JOIN `Tocken` AS t ON t.`id` = r.`tocken_id`
WHERE
  r.`tocken_id` IS NULL
  OR t.`id` IS NULL
  OR r.`webhook_secret` IS NULL
  OR CHAR_LENGTH(r.`webhook_secret`) < 32
  OR CHAR_LENGTH(r.`webhook_secret`) > 255;
```

Do not continue until this query returns no rows.

## Stage 3: Add the constraint and require both fields

```sql
ALTER TABLE `Repo`
  ADD CONSTRAINT `fk_repo_tocken_id`
    FOREIGN KEY (`tocken_id`)
    REFERENCES `Tocken` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE `Repo`
  MODIFY COLUMN `tocken_id` INT NOT NULL,
  MODIFY COLUMN `webhook_secret` VARCHAR(255) NOT NULL;
```

After this succeeds, restart the API and register the webhook in Gitea using
the matching secret and repository ID.

## Rollback

Rollback removes webhook configuration from every repository. Back up any
values needed for recovery before running it.

```sql
ALTER TABLE `Repo`
  DROP FOREIGN KEY `fk_repo_tocken_id`;

ALTER TABLE `Repo`
  DROP COLUMN `webhook_secret`,
  DROP COLUMN `tocken_id`;
```

If your database created a differently named foreign-key constraint, find it
before rollback:

```sql
SELECT `CONSTRAINT_NAME`
FROM `information_schema`.`KEY_COLUMN_USAGE`
WHERE
  `TABLE_SCHEMA` = DATABASE()
  AND `TABLE_NAME` = 'Repo'
  AND `COLUMN_NAME` = 'tocken_id'
  AND `REFERENCED_TABLE_NAME` = 'Tocken';
```
