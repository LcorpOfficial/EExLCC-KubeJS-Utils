# EExLCC KubeJS Utils

KubeJS scripts and assets for the EExLCC Cobblemon server.

Repository: https://github.com/LcorpOfficial/EExLCC-KubeJS-Utils

## Source directory

The server's `kubejs` directory is the Git repository root and the editing source.
Keep KubeJS Sync disabled here using the local, ignored
`config/kubejs_sync.json` file. This prevents downloaded scripts from running
alongside the source scripts.

The installed KubeJS Sync 1.0.0 accepts this repository-root pack layout; no
`packs/` wrapper is needed. `pack.json` supplies the stable pack ID `lcc`.

## Receiving instances

Install KubeJS Sync and its dependencies, then create
`kubejs/config/kubejs_sync.json` in each receiving instance:

```json
{
  "enabled": true,
  "useCacheOnFailure": true,
  "repos": [
    {
      "id": "lcc",
      "github": "LcorpOfficial/EExLCC-KubeJS-Utils",
      "branch": "main",
      "requires": [],
      "enabled": true
    }
  ]
}
```

After the initial commit has been pushed to GitHub, close the receiving game or
server. Back up its existing scripts outside `startup_scripts`, `server_scripts`,
and `client_scripts`, then move the original copies of this pack's scripts out
of those directories before launching. KubeJS Sync installs downloaded scripts
under `<script directory>/_synced/lcc/lcc/`; keeping the originals would run
both copies. Preserve any unrelated scripts.

The inspected MultiMC instance already contains original copies. Its
`server_scripts/pkmn_statue_placement_rules.js` differs from the source server's
copy, so preserve that file in the backup for comparison before replacing it.

Assets and data merge into their usual KubeJS directories. KubeJS Sync 1.0.0
does not deploy `config/`; distribute required configuration separately. In
particular, receiving servers need `config/npclistspawn.json` for the NPC list
commands. Never publish `config/web_server.json`, which contains instance
authentication settings.

Restart receiving instances to fetch updates. `/reload` does not fetch another
repository archive in this version. Check `logs/latest.log` for `KubeJSSync`,
`Fetching repo`, and `Deployed` messages. Server installation alone does not
configure clients; each receiving client needs its own mod and sync config.

## Publishing

Review changes before committing and pushing from this directory:

```powershell
git add .
git diff --cached
git commit -m "Describe your changes"
git push -u origin main
```

Use `git push` after the first push establishes the upstream branch.
Nothing can be downloaded from the new repository until the first commit is
pushed. Logs, generated sync state, downloaded scripts, local sync settings, and
web server credentials are excluded by `.gitignore`.
