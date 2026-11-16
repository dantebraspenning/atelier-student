#!/bin/sh
set -e
# Apply migrations first when asked (single instance / release phase). With several instances, run
# `node scripts/migrate.mjs` once as a release step instead and leave RUN_MIGRATIONS unset.
if [ "$RUN_MIGRATIONS" = "1" ]; then node scripts/migrate.mjs; fi
exec node server.js
