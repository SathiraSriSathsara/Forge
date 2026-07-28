# Docker Image Name Database Update

The project uses `sequelize.sync()` without a configured migration framework.
For an existing MySQL database, add and populate `Repo.image_name` in stages.
Back up the database before making schema changes.

## Stage 1: Add a nullable column

```sql
ALTER TABLE `Repo`
  ADD COLUMN `image_name` VARCHAR(255) NULL;
```

## Stage 2: Backfill existing rows

Assign each repository a unique, Docker-safe lowercase image name:

```sql
UPDATE `Repo`
SET `image_name` = 'forge-example-project'
WHERE `id` = 1;
```

Repeat for every existing repository. Recommended names use the `forge-`
prefix and contain lowercase letters, numbers, and hyphens.

Verify the backfill:

```sql
SELECT `id`, `repo_name`, `image_name`
FROM `Repo`
WHERE
  `image_name` IS NULL
  OR CHAR_LENGTH(TRIM(`image_name`)) = 0;
```

Do not continue until the query returns no rows.

## Stage 3: Require image names

```sql
ALTER TABLE `Repo`
  MODIFY COLUMN `image_name` VARCHAR(255) NOT NULL;
```

Fresh databases receive the required column from the Sequelize model when
`sequelize.sync()` creates the table.

## Rollback

```sql
ALTER TABLE `Repo`
  DROP COLUMN `image_name`;
```
