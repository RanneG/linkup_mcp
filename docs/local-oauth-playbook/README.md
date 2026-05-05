# Local OAuth playbook (loopback desktop + Google)

Portable checklist for **Web application** OAuth against **Google**, with redirect to **`http://127.0.0.1:<port>/.../callback`** and secrets in **`.env`** (not committed). Stitch implements this in **`stitch_auth/`** on the Flask bridge; this folder is the **generic** playbook.

## Which pieces belong on GitHub vs your PC?

| Artifact | Best home | Why (disk + workflow) |
|----------|-----------|------------------------|
| **This playbook** (markdown only) | **Own tiny GitHub repo** (e.g. `RanneG/local-oauth-playbook`) or stay here under `docs/` | Almost no size; bookmark or **shallow clone** (`--depth 1`) only when editing. No install footprint. |
| **stitch-api-types**, **voice-intents** (code packages) | **Inside `linkup_mcp`** `packages/` **or** publish **npm** | Avoids **N full clones** on one machine; one repo + `npm install` in apps that consume published packages. |
| **ui-bits** (components) | **GitHub + npm** when mature | Apps depend by **version**; you do **not** need the source repo on disk unless you are changing the design system. |

**Summary:** Put **docs-only** playbooks in a **small standalone repo** if you want them without cloning **linkup_mcp**. Keep **libraries you import** either in **one monorepo** you already use or **published packages** so other projects do not each need a separate checkout.

## Contents

- **[PLAYBOOK.md](PLAYBOOK.md)** — Console, env, redirect URI, restart, and popup/`postMessage` notes.
- **[examples/oauth.env.example](examples/oauth.env.example)** — Variable names only (no secrets).
- **[SPLITTING-TO-OWN-REPO.md](SPLITTING-TO-OWN-REPO.md)** — Optional: push this folder as its own repository.
