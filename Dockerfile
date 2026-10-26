# syntax=docker/dockerfile:1
#
# Beripika production image: nginx + PHP-FPM + queue worker + scheduler in one container
# (they share storage/app/private, where SOAIS uploads are processed).
# Built by GitHub Actions and pulled by Coolify. Listens on port 8080. No secrets at build time.

ARG PHP_VERSION=8.5
ARG NODE_VERSION=22

# ---------------------------------------------------------------------------------------------
# Base: PHP-FPM with the extensions Laravel, PhpSpreadsheet and the SOAIS reader need.
# ---------------------------------------------------------------------------------------------
FROM php:${PHP_VERSION}-fpm-trixie AS base

COPY --from=ghcr.io/mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions bcmath gd intl opcache pcntl pdo_mysql zip

WORKDIR /var/www/html

# ---------------------------------------------------------------------------------------------
# Build: Composer (no dev) + Vite. Node and PHP live together here because the Wayfinder Vite
# plugin runs `php artisan wayfinder:generate` during the frontend build.
# ---------------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS node

FROM base AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Dependencies first so they stay cached when only application code changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN composer dump-autoload --no-dev --optimize --no-interaction \
    && npm run build \
    && rm -rf node_modules

# ---------------------------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------------------------
FROM base AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/php/app.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/zz-app.conf
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisor/supervisord.conf /etc/supervisor/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint
# Guard against CRLF line endings from Windows checkouts.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint && chmod +x /usr/local/bin/docker-entrypoint

COPY --from=build --chown=www-data:www-data /var/www/html /var/www/html

# Safe defaults only; real configuration (APP_KEY, DB_*, APP_URL, ...) comes from Coolify.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/up || exit 1

ENTRYPOINT ["docker-entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
