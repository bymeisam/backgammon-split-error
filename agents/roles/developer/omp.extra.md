## Under omp

omp runs no guard hooks, so nothing checks for you where the database URLs point. omp's `.env` holds local URLs only (`DB_TARGET=local` and the `LOCAL_DATABASE_URL*` vars, never any `ORACLE_*` URL). Never set `DB_TARGET=oracle` or name the `ORACLE_DATABASE_URL*` vars: Oracle runs are the user's. Treat any command that could reach a database (prisma, `scripts/`, tsx/node, dev/start servers, Playwright, curl to localhost) as blocked unless the spec says the user confirmed every `.env*` file points at localhost. The task tool configuration is a backstop, not permission.
