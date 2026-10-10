# Minecraft server for the NAS (Java + Bedrock crossplay)

This is one survival world that everyone can join:

| Player is on | Edition | How they join |
|---|---|---|
| PC / Mac (Java) | Java | Multiplayer → Add Server → `NAS-ADDRESS` |
| iPhone, iPad, Android, Windows (Bedrock) | Bedrock | Play → Servers → Add Server → `NAS-ADDRESS`, port `19132` |
| **Nintendo Switch**, Xbox, PlayStation | Bedrock | Consoles have no "Add Server" button, so they need a workaround ([see below](#nintendo-switch-and-other-consoles)) |

The server runs [Paper](https://papermc.io/) with [Geyser](https://geysermc.org/) (lets Bedrock clients join) and [Floodgate](https://wiki.geysermc.org/floodgate/) (Bedrock players don't need to own Java Edition). It also keeps automatic backups. Everything runs in Docker using [`itzg/minecraft-server`](https://github.com/itzg/docker-minecraft-server).

> A Java-only server wouldn't work for anyone on a Switch, because Switch only runs Bedrock. Geyser is what lets her join.

---

## 1. What the NAS needs

- **Docker / Container support.** That's *Container Manager* on Synology, *Container Station* on QNAP, *Apps* on TrueNAS SCALE, or *Docker* on Unraid.
- **An x86 (Intel/AMD) or 64-bit ARM CPU.**
- **RAM.** Minecraft uses a lot. Set `MEMORY` in `docker-compose.yml` to fit your NAS:

  | NAS total RAM | `MEMORY` |
  |---|---|
  | 4 GB | `2G` (tight, but OK for a few kids) |
  | 8 GB | `3G`–`4G` |
  | 16 GB+ | `4G`–`6G` |

## 2. Edit the config

Open `docker-compose.yml` and change the three `CHANGE ME` items:

1. **`OPS`**: replace `YourJavaUsername` with your Java Edition username. This gives you full command access.
2. **`WHITELIST`**: your username plus your Java-playing cousins' usernames, one per line. Bedrock players get added later from inside the game.
3. **`RCON_PASSWORD`**: any long random text. Put **the same value** in both places it appears.

> If you play on Bedrock yourself, leave your name out of `OPS` and `WHITELIST` for now. Op yourself from the console after you join ([section 6](#6-admin-commands)).

## 3. Start it on the NAS

### UGREEN NASync (UGOS Pro)
1. **App Center**: install **Docker** if you haven't already.
2. **Files**: open the `docker` shared folder (the Docker app creates it) and make a folder inside it called `minecraft`.
3. **Docker → Project → Create**.
   - Project name: `minecraft`
   - Storage path: the `docker/minecraft` folder you just made
   - Compose config: paste in the edited `docker-compose.yml` (or upload it)
4. Click **Deploy / Done**. The first start downloads everything and takes a few minutes.
5. To watch progress: **Docker → Container → `mc` → Log**. It's ready when you see `Done (...)! For help, type "help"`.

For the console commands in [section 6](#6-admin-commands), turn on SSH under **Control Panel → Terminal**, then connect with `ssh youradminuser@NAS-IP`. You may need `sudo` before `docker`.

### Synology (DSM 7.2+)
1. **File Station**: create a folder, for example `docker/minecraft`.
2. **Container Manager → Project → Create**.
   - Name: `minecraft`
   - Path: the folder you just made
   - Source: *Upload docker-compose.yml* (or *Create docker-compose.yml* and paste it in)
3. Click **Next → Done**. It downloads everything and starts. The first start takes a few minutes.
4. To watch progress: **Container → `mc` → Log**. It's ready when you see `Done (...)! For help, type "help"`.

### Other NAS brands
- **QNAP Container Station**: *Applications → Create*, then paste the YAML.
- **TrueNAS SCALE 24.10+**: *Apps → Discover Apps → ⋮ → Install via YAML*.
- **Unraid**: use the *Docker Compose Manager* plugin.
- **Any NAS with SSH**: copy this folder over, then run `docker compose up -d` inside it.

On QNAP and TrueNAS, change `./data` and `./backups` to full paths on a share, for example `/mnt/tank/minecraft/data`.

### Synology/QNAP firewall
If the NAS firewall is on, allow **TCP 25565** and **UDP 19132**.

## 4. Find the address to give everyone

- **Same house / same Wi-Fi**: use the NAS's local IP, e.g. `192.168.1.50`. UGREEN shows it under *Control Panel → Network*, Synology under *Control Panel → Network → Network Interface*. Also set the NAS to a fixed IP (a "DHCP reservation" in your router) so the address doesn't change.
- **Cousins at their own houses**: on your **router**, set up port forwarding to the NAS's local IP:
  - **TCP 25565** (Java)
  - **UDP 19132** (Bedrock)

  Then give them your public IP (search "what is my ip"). Your public IP can change, so a free DDNS name is easier. UGREEN and Synology both offer DDNS in the NAS Control Panel; [DuckDNS](https://www.duckdns.org) also works.
- **Port forwarding doesn't work?** Your internet provider may be using CGNAT, which blocks incoming connections. The workaround is [playit.gg](https://playit.gg): it's free and can tunnel both the Java (TCP) and Bedrock (UDP) ports.

## 5. Letting your cousins in

The whitelist is on, so random people on the internet can't join.

**Java players**: either add their names to `WHITELIST` and restart, or type this in-game:
```
/whitelist add TheirJavaName
```

**Bedrock players** (phone, tablet, Switch, etc.): type this in-game:
```
/fwhitelist add TheirGamertag
```
If the gamertag has spaces, use underscores instead (`Cool Kid 22` → `Cool_Kid_22`).

If it says the player can't be found, they've never joined a Geyser server before. Fix:
1. `/whitelist off`
2. Have them join once
3. `/fwhitelist add TheirGamertag`
4. `/whitelist on`

In-game, Bedrock players' names start with a dot, e.g. `.Cool_Kid_22`. Use the dot whenever a command needs their name, such as `/op .Cool_Kid_22` or `/tp .Cool_Kid_22 ~ ~ ~`.

## 6. Admin commands

**From the NAS (server console).** SSH into the NAS and run:
```sh
docker exec -i mc rcon-cli
```
Then type commands without the `/`, e.g. `op .MyGamertag`. Press Ctrl-C to leave.
On Synology without SSH: *Container Manager → Container → `mc` → Action → Open terminal → Create → `bash`*, then run `rcon-cli`.

**In-game (as an op):**

| Command | What it does |
|---|---|
| `/gamemode creative` / `/gamemode survival` | Switch your mode |
| `/give @s diamond 64` | Give yourself items |
| `/tp TheirName` | Teleport to someone |
| `/time set day`, `/weather clear` | Fix night or rain |
| `/gamerule keepInventory true` | Kids keep their items when they die. On newer versions it may be `keep_inventory`; press Tab to autocomplete. |
| `/op TheirName` / `/deop TheirName` | Give or take admin |
| `/kick TheirName` | Kick someone |

## Nintendo Switch and other consoles

Console Bedrock (Switch, Xbox, PlayStation) has no "Add Server" button, only the built-in Featured Servers. She'll also need an active **Nintendo Switch Online** membership to play online. There are two ways to get her in:

### Option A: Friends tab (recommended, nothing changes on her Switch)
[MCXboxBroadcast](https://github.com/MCXboxBroadcast/Broadcaster) makes the server show up in her **Friends** tab, as if a friend were hosting a game.

1. Make a **spare Microsoft account** for the server. The project recommends a separate account rather than your main one.
2. Download `MCXboxBroadcastExtension.jar` from <https://github.com/MCXboxBroadcast/Broadcaster/releases/latest>.
3. Put it in `data/plugins/Geyser-Spigot/extensions/` (create the `extensions` folder if it's missing), then restart the `mc` container.
4. The `mc` log will show a code and a link (`https://www.microsoft.com/link`). Open the link and sign in with the **spare** account.
5. On her Switch, add the spare account's gamertag as a friend in Minecraft.
6. The server will appear in her **Friends** tab, and she can tap it to join.

### Option B: BedrockConnect (change the Switch's DNS)
[BedrockConnect](https://github.com/Pugmatt/BedrockConnect) changes the Switch's DNS setting so that a Featured Server opens a menu where you can type in any server address. It works, but it routes the Switch's DNS through a third party, so Option A is cleaner.

**Simplest stopgap:** if a cousin on a phone or tablet is already on the server, she can join through *their* game in the Friends tab, as long as they're friends on Xbox Live.

## 7. Backups

The `backups` container saves the world every 6 hours while anyone is online and keeps 7 days of copies in `./backups`.

To restore a backup:
1. Stop the project (Synology: *Project → minecraft → Stop*).
2. Rename `data` to `data-old` (keeps a copy just in case).
3. Create a new empty `data` folder and extract the backup `.tgz` you want into it.
4. Start the project.

You can also copy the `backups` folder somewhere else (Synology Hyper Backup, cloud, etc.) for extra safety.

## 8. Updating

Bedrock devices update themselves automatically. If Bedrock players suddenly get an "outdated" error, **restart the project**. Each start downloads the newest Paper, Geyser and Floodgate (and the newest Docker image once a day).

## Troubleshooting

- **Container keeps restarting**: check the `mc` log.
  - `Unable to find user` or similar → a name in `OPS`/`WHITELIST` is misspelled or is still `YourJavaUsername`.
  - Out-of-memory errors → lower `MEMORY`.
- **`Permission denied` on `/data`**: the folder on the NAS isn't writable by the container. Add `UID` and `GID` under `environment` with your NAS user's IDs (run `id` over SSH; on Synology it's often `UID: "1026"`, `GID: "100"`).
- **Java works but Bedrock doesn't**: the problem is almost always UDP 19132. Check the port forward is **UDP** (not TCP) and the NAS firewall allows it.
- **Laggy**: lower `VIEW_DISTANCE` to `6`, or raise `MEMORY` if the NAS has spare RAM.
