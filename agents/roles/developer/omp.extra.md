## Under omp

omp runs no guard hooks, so nothing checks for you where `DATABASE_URL` points. Treat any command that could reach a database (prisma, `scripts/`, tsx/node, dev/start servers, Playwright, curl to localhost) as blocked unless the spec says the user confirmed every `.env*` file points at localhost. The task tool configuration is a backstop, not permission.
