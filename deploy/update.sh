#!/bin/bash
# Применяет обновление на сервере. Запуск: cd /var/www/LamiaCRM && git pull && bash deploy/update.sh
set -e
cd "$(dirname "$0")/.."

npm run db:init
cp deploy/upload.conf /etc/nginx/conf.d/upload.conf
nginx -t
systemctl reload nginx
systemctl restart lamiacrm
echo "Обновление применено"
