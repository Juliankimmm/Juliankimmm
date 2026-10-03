# Minecraft Server on a NAS

A Docker Compose setup for running a Minecraft **Java Edition** server on a home NAS, built on the widely used [`itzg/minecraft-server`](https://github.com/itzg/docker-minecraft-server) image.

**What you get**

- A [Paper](https://papermc.io/) server (faster than vanilla, supports plugins) that downloads itself on first start
- Automatic world backups every 6 hours while people are playing, kept for 14 days ([`itzg/mc-backup`](https://github.com/itzg/docker-mc-backup))
- A whitelist turned on by default, so only people you add can join
- Optional crossplay so Bedrock players (phones, tablets, Windows) can join through [Geyser](https://geysermc.org/). Consoles need an extra workaround such as [BedrockConnect](https://github.com/Pugmatt/BedrockConnect).
- Settings tuned for NAS CPUs (lower view and simulation distance, Aikar's JVM flags)

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines the server and backup containers. You normally don't need to edit it. |
| `.env.example` | All the settings. Copy it to `.env` and fill it in. |

## Before you start

1. **Docker on your NAS.** Synology: *Container Manager*. QNAP: *Container Station*. Unraid: built in. TrueNAS SCALE 24.10 or newer: built in (*Apps*). OpenMediaVault: the *compose* plugin.
2. **RAM.** Plan for roughly `MEMORY` + 1 GB free. A NAS with 4 GB total can handle a small server with `MEMORY=2G`. 8 GB or more is comfortable.
3. **A fixed LAN IP for the NAS.** Set a DHCP reservation on your router so the address doesn't change.
4. **Your NAS user's UID/GID.** SSH in and run `id your-username`. Put the numbers in `MC_UID` and `MC_GID`. This lets you open the world files over SMB. Typical values are listed in `.env.example`.

## Setup

### Option A: Synology (Container Manager)

1. In **File Station**, create a folder, for example `docker/minecraft` (full path `/volume1/docker/minecraft`).
2. Upload `docker-compose.yml` and `.env.example` into it.
3. Rename `.env.example` to `.env` and edit it: set `RCON_PASSWORD`, `MC_UID`/`MC_GID` (usually `1026`/`100`), `TZ`, `OPS` and `WHITELIST`. File Station can't edit text files, so either:
   - download the file, edit it on your computer and upload it again, or
   - install the *Text Editor* package.
4. Open **Container Manager → Project → Create**.
   - Project name: `minecraft`
   - Path: `/volume1/docker/minecraft`
   - Source: *Use existing docker-compose.yml*
5. Click through and start the project. The first start takes a few minutes while the server downloads and generates the world. Watch progress in **Container → minecraft → Log**. It's ready when the log shows `Done (...)! For help, type "help"`.
6. If the Synology firewall is on (**Control Panel → Security → Firewall**), allow TCP port `25565`, and also UDP `19132` if you turn on Bedrock crossplay.

### Quickest: the setup script (UGREEN, Synology, or any NAS with SSH)

SSH into the NAS as your normal user and run:

```sh
curl -fsSLO https://raw.githubusercontent.com/Juliankimmm/Juliankimmm/claude/laughing-noether-92a7w7/minecraft-server/setup.sh && bash setup.sh
```

The script puts everything in `/volume1/docker/minecraft` (pass a different folder as the first argument if needed). It asks for your Minecraft name, your friends' names and your timezone, fills in the rest of `.env` for you, starts the server and tells you when it's ready.

### Option B: Any NAS over SSH (Synology, QNAP, Unraid, OMV, plain Linux)

```sh
# Pick a folder on your data volume
mkdir -p /volume1/docker/minecraft && cd /volume1/docker/minecraft

# Copy docker-compose.yml and .env.example here (scp, SMB, or git clone), then:
cp .env.example .env
nano .env                         # or vi: fill in the settings

sudo docker compose up -d         # start in the background
sudo docker compose logs -f mc    # watch it boot (Ctrl+C stops watching, not the server)
```

On older systems the command may be `docker-compose` (with a hyphen) instead of `docker compose`.

### Option C: TrueNAS SCALE

TrueNAS manages apps itself, so don't run `docker compose` from its shell. You have two choices:

- **Easiest:** use the **Minecraft** app from **Apps → Discover Apps**. It's built on the same `itzg` image, but it doesn't include the backup container.
- **This exact setup:** go to **Apps → Discover Apps → ⋮ → Install via YAML** and paste in `docker-compose.yml`. The YAML installer doesn't read `.env` files, so replace each `${VAR:-default}` with your value. Use a dataset path such as `/mnt/tank/apps/minecraft/data` for the volumes and set `MC_UID`/`MC_GID` to `568`.

### Option D: Unraid

Install **Docker Compose Manager** from the *Apps* tab. Then go to **Docker → Compose → Add New Stack**, paste `docker-compose.yml` with *Edit Stack*, and paste your `.env` with *Edit Env*. Set `DATA_DIR=/mnt/user/appdata/minecraft/data`, `BACKUP_DIR=/mnt/user/backups/minecraft` and `MC_UID=99`, `MC_GID=100`.

### Option E: QNAP (Container Station 3)

Go to **Applications → Create**, paste `docker-compose.yml`, and replace each `${VAR:-default}` with your value. Alternatively, use Option B over SSH, which reads `.env` directly.

## Connecting

**At home:** in Minecraft, go to **Multiplayer → Add Server** and enter the NAS IP, for example `192.168.1.50`. If you changed `MC_PORT`, add it after a colon, like `192.168.1.50:25566`.

**Friends outside your home** need one of these:

1. **Port forwarding (most common).** On your router, forward **TCP 25565** to the NAS's LAN IP. For Bedrock crossplay, also forward **UDP 19132**. Friends connect with your public IP or a dynamic DNS name. Synology offers a free one under **Control Panel → External Access → DDNS** (`yourname.synology.me`).
   - If forwarding doesn't work, your ISP may be using CGNAT: the WAN IP shown on your router won't match [whatismyip.com](https://whatismyip.com). In that case, use option 2 or 3.
   - From inside your home, use the LAN IP. Many routers can't loop back to their own public IP.
2. **[Tailscale](https://tailscale.com/).** Private, no open ports. Install it on the NAS (Synology and QNAP have packages, Unraid has a plugin), share the NAS with friends, and they connect to its Tailscale IP. Every friend has to install Tailscale, so this doesn't work for consoles.
3. **[playit.gg](https://playit.gg/).** A free tunnel that gives you a public address without port forwarding. It works even behind CGNAT.

## Running the server

**Admin console:** run `sudo docker exec -i minecraft rcon-cli`. On Synology you can also use **Container Manager → Container → minecraft → Action → Open terminal**, then type `rcon-cli`.

```
> whitelist add FriendName
> op FriendName
> say Server restarting in 5 minutes
```

For a single command, put it after `rcon-cli`, for example `sudo docker exec minecraft rcon-cli whitelist add FriendName`.

Players you add in-game stay added. Names in `WHITELIST`/`OPS` in `.env` are merged in on every start.

**Changing settings:** edit `.env`, then run `sudo docker compose up -d` (or on Synology: Project → minecraft → Stop, then Build). For any `server.properties` option not in `.env`, see the [variable list](https://docker-minecraft-server.readthedocs.io/en/latest/configuration/server-properties/).

**Idle CPU:** Minecraft 1.21.2+ pauses the world on its own when nobody is online, so an empty server barely uses any CPU.

## Bedrock crossplay (optional)

1. In `docker-compose.yml`, uncomment the `19132:19132/udp` port line and the `PLUGINS:` block (3 lines).
2. Run `sudo docker compose up -d` again.
3. Bedrock players add a server with your address and port `19132`.

Floodgate lets Bedrock players join without owning Java Edition. Their names show up with a `.` prefix. To whitelist one, run `fwhitelist add TheirGamertag` in the admin console (the normal `whitelist add` can't look up Bedrock names). Geyser follows the latest Minecraft release, so keep `MC_VERSION=LATEST` if you use it.

## Mods instead of plugins

Set `SERVER_TYPE=FABRIC` (or `FORGE`/`NEOFORGE`) and pin `MC_VERSION` to the version your mods need. Mods can be pulled automatically from Modrinth with `MODRINTH_PROJECTS`. To install a whole modpack, set `SERVER_TYPE=MODRINTH` or `AUTO_CURSEFORGE`. See the [mods & plugins docs](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/). Modded servers usually need `MEMORY=6G` or more, and every player needs the same mods installed.

## Backups

- Backups are written as `world-YYYYMMDD-HHMMSS.tgz` in `BACKUP_DIR`: every `BACKUP_INTERVAL` while players are online, and once when the containers start.
- Backups older than `PRUNE_BACKUPS_DAYS` are deleted automatically.
- **Back up now:** `sudo docker exec minecraft-backups backup now`
- A backup on the same disks as the world won't survive a NAS failure. Copy the backups folder somewhere else as well, for example with Hyper Backup or Cloud Sync on Synology, or Cloud Sync Tasks on TrueNAS.

**Restoring a backup:**

```sh
cd /volume1/docker/minecraft
sudo docker compose down
sudo mv data data-before-restore
sudo mkdir data
sudo tar -xzf backups/world-YYYYMMDD-HHMMSS.tgz -C data
sudo docker compose up -d
```

## Updating

```sh
sudo docker compose pull     # newer container images
sudo docker compose up -d
```

With `MC_VERSION=LATEST`, the server also moves to the newest Minecraft release whenever it restarts. To control upgrades, pin a version such as `MC_VERSION=1.21.10`, and take a backup before changing it. Worlds can't be downgraded.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Server stays "starting"/unhealthy on first boot | Check the logs (`docker compose logs mc`). The first world generation on a slow NAS can take a few minutes. The backup container waits until the server is healthy. |
| `Permission denied` in the logs | `MC_UID`/`MC_GID` don't match a user that can write to `DATA_DIR`. Check them with `id your-username`. |
| Lag or rubber-banding | Lower `VIEW_DISTANCE`/`SIMULATION_DISTANCE`, make sure `MEMORY` isn't more than the NAS can spare, and keep the world on SSD storage if you have it. |
| Container keeps restarting / killed | The NAS is out of RAM. Lower `MEMORY`. |
| Works at home, not for friends | Check the port forward, the NAS firewall, and CGNAT (see [Connecting](#connecting)). |
| "Outdated server" / "Outdated client" | Set `MC_VERSION` to the version players are running, or update the game. |
| Error mentioning `RCON_PASSWORD` when starting | Make sure `.env` exists next to `docker-compose.yml` and sets `RCON_PASSWORD`. |
| Bedrock friends can't connect | The `19132/udp` port must be uncommented, forwarded as **UDP**, and allowed through the NAS firewall. |
