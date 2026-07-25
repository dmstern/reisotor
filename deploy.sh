#!/bin/bash
set -e

# Persoenliche Werte kommen aus .env (gitignored, siehe .env.example zum Anlegen).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fehler: $ENV_FILE fehlt. Kopiere .env.example zu .env und trage deine Werte ein." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${SSH_USER:?SSH_USER fehlt in .env}"
: "${PUBLIC_HOST:?PUBLIC_HOST fehlt in .env}"

# LOCAL_HOST ist optional: nur relevant, falls PUBLIC_HOST vom selben Netz aus
# (z. B. per NAT-Hairpin) nicht erreichbar ist und keine lokale Alternativroute
# existiert (z. B. via /etc/hosts). Wenn nicht gesetzt, wird direkt PUBLIC_HOST genutzt.
if [ -n "${LOCAL_HOST:-}" ]; then
  echo "Pruefe, ob der Server ueber LOCAL_HOST erreichbar ist..."
  if ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new \
      "$SSH_USER@$LOCAL_HOST" true 2>/dev/null; then
    HOST="$LOCAL_HOST"
    echo "-> Erreichbar, nutze $HOST"
  else
    HOST="$PUBLIC_HOST"
    echo "-> LOCAL_HOST nicht erreichbar, nutze $HOST"
  fi
else
  HOST="$PUBLIC_HOST"
fi

echo "Baue Frontend..."
cd "$SCRIPT_DIR/frontend"
npm run build
cd "$SCRIPT_DIR"

echo "Baue Backend..."
cd "$SCRIPT_DIR/backend"
npm run build
cd "$SCRIPT_DIR"

echo "Kopiere Frontend nach /var/www/reisotor..."
rsync -avz --delete -e "ssh -o ConnectTimeout=10" frontend/dist/ "$SSH_USER@$HOST:/var/www/reisotor/"

echo "Kopiere Backend..."
# dist/ und package*.json getrennt syncen: der systemd-Service erwartet den
# kompilierten Code unter ~/reisotor/backend/dist/server.js (siehe .service-Datei).
rsync -avz --delete -e "ssh -o ConnectTimeout=10" \
  --exclude node_modules \
  --exclude '*.db' \
  --exclude '*.sqlite' \
  --exclude '*.sqlite-*' \
  backend/dist/ "$SSH_USER@$HOST:~/reisotor/backend/dist/"
rsync -avz -e "ssh -o ConnectTimeout=10" \
  backend/package.json backend/package-lock.json \
  "$SSH_USER@$HOST:~/reisotor/backend/"

echo "Installiere Produktions-Dependencies und starte Backend neu..."
ssh -o ConnectTimeout=10 "$SSH_USER@$HOST" "cd ~/reisotor/backend && npm ci --omit=dev && sudo systemctl restart reisotor"

echo "Fertig! https://$PUBLIC_HOST"
