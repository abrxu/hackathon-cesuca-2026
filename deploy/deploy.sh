#!/usr/bin/env bash
# Forced command da chave do GitHub Actions (~/.ssh/authorized_keys na VPS).
# Aceita só "<sha de 40 caracteres>" de um commit que esteja na origin/main.
set -euo pipefail
cd /opt/hackathon

sha="${SSH_ORIGINAL_COMMAND:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "uso: <sha de 40 caracteres>" >&2; exit 2; }

exec 9>/tmp/hackathon-deploy.lock
flock 9

# O workflow manda o .env (montado a partir dos secrets do repositório) pelo stdin.
tmp=$(mktemp /opt/hackathon/.env.XXXX)
cat > "$tmp"
if grep -q '^POSTGRES_PASSWORD=.' "$tmp" && grep -q '^JWT_SECRET=.' "$tmp"; then
  chmod 600 "$tmp" && mv "$tmp" .env
else
  rm -f "$tmp"
fi

echo "==> deploy @ $sha"
git -C src fetch --quiet origin main
git -C src merge-base --is-ancestor "$sha" origin/main \
  || { echo "commit $sha não está na origin/main" >&2; exit 3; }
git -C src checkout --quiet --force "$sha"

docker compose -f src/deploy/compose.prod.yml --env-file .env up -d --build --remove-orphans
docker image prune -f >/dev/null

# Health check aqui dentro: o firewall da VPS não aceita conexão direta dos runners do GitHub.
echo "==> health check"
ok=0
for i in $(seq 1 30); do
  if docker compose -f src/deploy/compose.prod.yml --env-file .env exec -T backend \
      python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/health',timeout=5)" 2>/dev/null; then
    ok=1; break
  fi
  sleep 3
done
docker compose -f src/deploy/compose.prod.yml --env-file .env ps
[[ $ok == 1 ]] || { echo "health check falhou" >&2; exit 4; }
echo "==> health ok"
