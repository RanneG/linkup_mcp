# Deploying the Flask app to Phala Cloud CPU TEE

Step-by-step instructions for deploying this transcript-processing Flask app to **Phala Cloud CPU TEE** using the **Phala CLI**. The app runs inside a Confidential Virtual Machine (CVM) with TEE isolation.

---

## Prerequisites

- A [Phala Cloud account](https://cloud.phala.network/register)
- **Node.js 18+** or [Bun](https://bun.sh/) (for the Phala CLI)
- This repo’s `backend/` directory with the Dockerfile and app code

---

## Step 1: Install the Phala CLI

Install the CLI globally:

```bash
npm install -g phala
```

Or run without installing:

```bash
npx phala <command>
```

---

## Step 2: Log in to Phala Cloud

Use device flow (opens browser to complete login):

```bash
phala login
```

Or create an API token in the [dashboard](https://cloud.phala.network/dashboard) (username → API Tokens → Create Token), then:

```bash
phala login --manual
```

Verify you’re logged in:

```bash
phala status
```

If you see **Not authenticated** on later commands after a successful login, credentials were saved to a **profile**. Switch to it (profile name from the "Credentials saved successfully (profile: …)" message): `phala switch <profile-name>` (e.g. `phala switch kyladizonangeless-projects`). Then run `phala status` again. Alternatively, use an API token from the dashboard: `export PHALA_CLOUD_API_KEY="your-token"`.

---

## Step 3: Prepare the deployment

From the **backend** directory:

```bash
cd backend
```

Use the Phala-ready Compose file that mounts the TEE communication socket:

- **File:** `docker-compose.phala.yml`  
- It’s the same as `docker-compose.yml` but adds:
  - `volumes: - /var/run/dstack.sock:/var/run/dstack.sock`  
  so the app can talk to the TEE environment.

---

## Step 4: Set environment variables (optional)

If your app needs env vars (e.g. `FLASK_DEBUG`, `PORT`), pass them at deploy time with `-e`:

```bash
phala deploy -c docker-compose.phala.yml -n lucky-charm-tee -e FLASK_DEBUG=false -e PORT=8080
```

Multiple variables:

```bash
phala deploy -c docker-compose.phala.yml -n lucky-charm-tee \
  -e FLASK_DEBUG=false \
  -e PORT=8080
```

For **secrets** (API keys, etc.), use [Phala’s encrypted environment variables](https://docs.phala.network/phala-cloud/phala-cloud-user-guides/create-cvm/set-secure-environment-variables): declare them in your Compose (e.g. `MY_SECRET=${MY_SECRET}`) and set the values in the Phala Cloud UI or via encrypted secrets—they are decrypted only inside the TEE. Do not put real secrets in `-e` in shared instructions.

---

## Why "build: ." fails on Phala (Dockerfile: no such file or directory)

Phala Cloud **does not upload** your project files (Dockerfile, app code) when you run `phala deploy`. It only receives the compose file. So if the compose has `build: .`, the CVM tries to run `docker build` with **no build context** and fails with `open Dockerfile: no such file or directory`.

**Fix:** Build the image on your machine, push it to a container registry (Docker Hub or GHCR), and use a compose file that references the **image** (not `build: .`). Phala will pull the image and run it.

---

## Build and push image for Phala (required)

From the **backend** directory, build for linux/amd64 (Phala’s architecture) and push to Docker Hub (or GHCR). Replace `YOUR_DOCKERHUB_USER` with your Docker Hub username.

```bash
cd backend
docker build --platform linux/amd64 -t YOUR_DOCKERHUB_USER/lucky-charm-tee:latest .
docker push YOUR_DOCKERHUB_USER/lucky-charm-tee:latest
```

If you use GitHub Container Registry:

```bash
docker build --platform linux/amd64 -t ghcr.io/YOUR_GITHUB_USER/lucky-charm-tee:latest .
docker push ghcr.io/YOUR_GITHUB_USER/lucky-charm-tee:latest
```

Then edit `docker-compose.phala.registry.yml`: set `image:` to your full image name (e.g. `myuser/lucky-charm-tee:latest` or `ghcr.io/myuser/lucky-charm-tee:latest`).

**After pushing a new image:** Use **Update** in the Phala dashboard (or run `phala deploy` again), not just **Restart**. Restart reuses the same container image; Update pulls the new `latest` image and recreates the CVM.

---

## Step 5: Deploy the app

Deploy using the **registry** compose file (image already built and pushed):

```bash
phala deploy -c docker-compose.phala.registry.yml -n lucky-charm-tee
```

If you still use `docker-compose.phala.yml` (with `build: .`), deploy will fail with "Dockerfile: no such file or directory" on Phala. Use `docker-compose.phala.registry.yml` and the build+push step above.

Example success output:

```json
{
  "success": true,
  "vm_uuid": "...",
  "name": "lucky-charm-tee",
  "app_id": "...",
  "dashboard_url": "https://cloud.phala.network/dashboard/cvms/..."
}
```

---

## Step 6: Check deployment status

Until the CVM is running, status will show something other than `running`:

```bash
phala cvms get lucky-charm-tee
```

When status is **running**, continue to the next step.

---

## Step 7: Get the public URL

Get the URL where your app is reachable:

```bash
phala cvms get lucky-charm-tee --json | jq -r '.public_urls[0].app'
```

If you don’t have `jq`, run without `--json` and read the `public_urls` section from the output.

Example result:

```text
https://<app-id>-8080.dstack-pha-prod3.phala.network
```

Your Flask app is served at:

- **Health:** `https://<that-url>/health`
- **Process:** `https://<that-url>/process`

---

## Step 8: Verify the deployment

1. **Health check** in a browser or with curl:

   ```bash
   curl https://<your-public-url>/health
   ```

   Expected: `{"status":"running"}`.

2. **Process endpoint** (optional):

   ```bash
   curl -X POST https://<your-public-url>/process \
     -H "Content-Type: application/json" \
     -d '{"transcript": "We decided to ship next week. I will update the docs."}'
   ```

   Expected: JSON with `blockers`, `action_items`, and `decisions` arrays.

3. **Lucky Charm frontend:**  
   In the app’s **Dev** tab, set **Live TEE** and set **TEE endpoint** (or `VITE_TEE_URL`) to your public URL (e.g. `https://<app-id>-8080.dstack-pha-prod3.phala.network`). Upload a transcript and confirm the Dashboard shows results from the TEE.

---

## Useful commands

| Command | Description |
|--------|-------------|
| `phala cvms get lucky-charm-tee` | Check CVM status |
| `phala logs --cvm-id lucky-charm-tee` | View container logs |
| `phala cvms stop lucky-charm-tee` | Stop the CVM (billing pauses) |
| `phala cvms start lucky-charm-tee` | Start it again |
| `phala cvms delete lucky-charm-tee` | Delete the CVM and stop billing |
| `phala cvms attestation lucky-charm-tee` | View TEE attestation report |

---

## Link the project (optional)

After the first deploy, link the repo so later deploys don’t need the CVM name:

```bash
phala link lucky-charm-tee
```

This creates `phala.toml` in the current directory. Commit it. Then you can run:

```bash
phala deploy
phala logs
phala cvms get
```

without passing the CVM name.

---

## Fresh deploy: delete in dashboard, then create a new CVM

If the same CVM keeps failing with "failed to start containers", use a **clean slate** instead of updating the old instance:

1. **In the Phala dashboard**  
   Open your CVM → delete the instance (e.g. **Settings** or the CVM menu → **Delete**). That frees the name and removes the broken CVM.

2. **From your machine (backend folder, with API key)**  
   Create a **new** CVM with the correct Docker setup in one go:
   ```bash
   cd "/Users/kylaangeles/Desktop/LUCKY CHARM/backend"
   export PHALA_CLOUD_API_KEY="your-token"   # or use .env
   npx phala deploy -c docker-compose.phala.yml -n lucky-charm-tee
   ```
   This creates a **new** CVM named `lucky-charm-tee` and builds the image from scratch (platform: linux/amd64, dstack.sock, Python 3.11-slim). No leftover state from the old CVM.

3. **Optional: link for future updates**  
   After the new CVM is running:  
   `npx phala link lucky-charm-tee`

---

## Troubleshooting: "boot failed: failed to start containers"

If the CVM reports **boot failed: failed to start containers**:

1. **Architecture (most common on Apple Silicon)**  
   Phala’s TEE is **x86_64**. Images built on ARM (e.g. M1/M2 Mac) can cause an `exec format error` and container start failure.  
   **Fix:** `docker-compose.phala.yml` already sets `platform: linux/amd64` so the image is built for x86_64. Redeploy:
   ```bash
   phala deploy -c docker-compose.phala.yml -n lucky-charm-tee
   ```
   If you build the image yourself before deploy, use:
   ```bash
   docker build --platform linux/amd64 -t your-image .
   ```

2. **Base image**  
   Use an official, maintained base (e.g. `python:3.9-slim` or `python:3.11-slim`). Avoid deprecated or custom bases that might be blocked.

3. **dstack.sock**  
   Only mount the socket: `- /var/run/dstack.sock:/var/run/dstack.sock`. Do not mount `dstack.sock.lock`.

4. **Get the real error**  
   In the dashboard, open your CVM → **Overview** or **Observability** and find **container logs**. The log shows the actual failure (e.g. `exec format error`, Python traceback).

5. **Force a clean rebuild**  
   Delete the CVM and redeploy so Phala rebuilds from scratch:  
   `npx phala cvms delete lucky-charm-tee` then  
   `npx phala deploy -c docker-compose.phala.yml -n lucky-charm-tee`.  
   Then run `npx phala link lucky-charm-tee` again.

6. **Stuck CVM**  
   If the CVM won’t restart, use the dashboard **Power Off** (not Stop), wait for it to shut down, then start again.

See also: [Phala Troubleshooting](https://docs.phala.com/phala-cloud/troubleshooting/troubleshooting).

---

## Summary

1. Install CLI: `npm install -g phala`
2. Log in: `phala login`
3. From `backend/`: deploy with `docker-compose.phala.yml`:  
   `phala deploy -c docker-compose.phala.yml -n lucky-charm-tee` (add `-e VAR=value` as needed).
4. Wait until `phala cvms get lucky-charm-tee` shows **running**.
5. Get URL: `phala cvms get lucky-charm-tee --json | jq -r '.public_urls[0].app'`.
6. Verify: `curl https://<url>/health` and optionally test `/process` and the Lucky Charm frontend with Live TEE pointing at that URL.
