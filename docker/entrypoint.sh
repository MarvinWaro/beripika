#!/bin/sh
# Container start-up: prepare storage, cache config with the runtime (Coolify) environment, then
# hand over to supervisord. Migrations stay manual unless RUN_MIGRATIONS=true.
set -e

cd /var/www/html

if [ -z "${APP_KEY:-}" ]; then
    echo "APP_KEY is not set. Add it in Coolify -> Environment Variables." >&2
    exit 1
fi

# A freshly mounted storage volume is empty: recreate Laravel's layout.
mkdir -p \
    storage/app/private \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

php artisan optimize

chown -R www-data:www-data storage bootstrap/cache

exec "$@"
