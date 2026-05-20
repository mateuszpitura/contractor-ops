-- Bootstrap second region database in the same Postgres instance.
-- The default DB (POSTGRES_DB) is contractor_ops_eu; this adds the ME twin
-- so DATABASE_URL_EU and DATABASE_URL_ME both resolve locally.
--
-- Runs once on first container start (when /var/lib/postgresql/data is
-- empty). Re-run by dropping the `app_db_data` volume.
SELECT 'CREATE DATABASE contractor_ops_me OWNER app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'contractor_ops_me')
\gexec

SELECT 'CREATE DATABASE contractor_ops_cms OWNER app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'contractor_ops_cms')
\gexec
