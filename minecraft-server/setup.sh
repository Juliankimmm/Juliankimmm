#!/usr/bin/env bash
# First-time setup for the Minecraft server. Run it on the NAS over SSH:
#
#   bash setup.sh [folder]     (folder defaults to /volume1/docker/minecraft)
#
# It downloads the compose file into the folder, asks a few questions,
# writes .env (UID/GID and a random RCON password are filled in for you)
# and starts the server. Re-running it keeps an existing .env.
set -e

BASE=${BASE:-https://raw.githubusercontent.com/Juliankimmm/Juliankimmm/claude/laughing-noether-92a7w7/minecraft-server}
DIR=${1:-/volume1/docker/minecraft}

if [ "$(id -u)" = 0 ]; then
  echo "Run this as your normal NAS user, without sudo:  bash setup.sh"
  exit 1
fi

echo
echo "If asked for a password, type your NAS password and press Enter."
echo "(Nothing appears on screen while you type. That's normal.)"
sudo -v

if sudo docker compose version >/dev/null 2>&1; then
  compose() { sudo docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { sudo docker-compose "$@"; }
else
  echo "Docker isn't installed yet. Install the Docker app from the App Center, then run this again."
  exit 1
fi

sudo mkdir -p "$DIR"
sudo chown "$(id -u):$(id -g)" "$DIR"
cd "$DIR"
mkdir -p data backups

for f in docker-compose.yml .env.example; do
  if [ ! -f "$f" ]; then
    curl -fsSL "$BASE/$f" -o "$f"
  fi
done

if [ -f .env ]; then
  echo "Using the settings already saved in $DIR/.env"
else
  echo
  me=
  while [ -z "$me" ]; do
    read -rp "Your Minecraft username: " me
    me=$(printf '%s' "$me" | tr -d ' ')
  done
  read -rp "Friends' Minecraft usernames, separated by commas (or just press Enter): " friends
  friends=$(printf '%s' "$friends" | tr -d ' ')

  tz_default=$(cat /etc/timezone 2>/dev/null || true)
  if [ -z "$tz_default" ]; then
    tz_default=UTC
  fi
  read -rp "Timezone [press Enter for $tz_default]: " tz
  tz=${tz:-$tz_default}

  whitelist=$me
  if [ -n "$friends" ]; then
    whitelist="$me,$friends"
  fi
  rcon_password=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)

  sed -e "s|^RCON_PASSWORD=.*|RCON_PASSWORD=$rcon_password|" \
      -e "s|^MC_UID=.*|MC_UID=$(id -u)|" \
      -e "s|^MC_GID=.*|MC_GID=$(id -g)|" \
      -e "s|^TZ=.*|TZ=$tz|" \
      -e "s|^OPS=.*|OPS=$me|" \
      -e "s|^WHITELIST=.*|WHITELIST=$whitelist|" \
      .env.example > .env
  chmod 600 .env
  echo "Saved settings to $DIR/.env (admin: $me, allowed players: $whitelist)"
fi

echo
echo "Starting the server. The first start downloads Minecraft and builds the"
echo "world, which can take 3-10 minutes..."
compose up -d

status=
for _ in $(seq 1 60); do
  status=$(sudo docker inspect -f '{{.State.Health.Status}}' minecraft 2>/dev/null || true)
  if [ "$status" = healthy ] || [ "$status" = unhealthy ]; then
    break
  fi
  printf '.'
  sleep 10
done
echo

ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}')
if [ "$status" = healthy ]; then
  echo "The server is up!"
  echo "In Minecraft: Multiplayer > Add Server > Server Address: ${ip:-<your NAS IP>}"
else
  echo "The server isn't ready yet. Watch its progress with:"
  echo "  sudo docker logs -f minecraft"
  echo "(press Ctrl+C to stop watching; the server keeps running)"
fi
