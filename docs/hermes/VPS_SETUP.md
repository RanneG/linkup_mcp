# Hermes + Nami on VPS (runtime host)

**Decision (2026):** Runtime Nami lives on a **small Linux VPS** (24/7 Telegram). **Windows PC** = Cursor, git, Stitch bridge, mobile-build worker. **Mac** = optional spare — not required.

## Architecture

```
📱 Phone (Telegram)
       ↓
☁️  VPS — Hermes gateway, memory, skills, linkup MCP
       ↓  Tailscale (when PC is on)
💻 PC — Cursor, nami_build_bridge :8770, stitch :8765
```

| Surface | Host | Role |
|---------|------|------|
| Phone | — | Chat + enqueue builds |
| VPS | Always on | Telegram Nami, Ollama or cloud LLM, MCP search/RAG |
| PC | When coding/gaming | Build agent, pytest, review in Cursor |
| Mac | Off most days | Skip — or backup SSH only |

Cross-device overview: [NAMI.md](./NAMI.md). PC usage: [PC_CLIENT.md](./PC_CLIENT.md).

---

## 1. Pick a VPS

| Tier | RAM | LLM | Typical cost | Use when |
|------|-----|-----|--------------|----------|
| **A — cloud model** | 2–4 GB | Hermes portal / API | ~$5–12/mo | Cheapest 24/7 Telegram; RAG still local |
| **B — local Ollama** | 8–16 GB | `qwen2.5:7b` | ~$15–40/mo | Free inference; matches old Mac setup |

**Providers:** Hetzner, DigitalOcean, Linode, Vultr — any **Ubuntu 22.04/24.04** VPS with SSH.

**Do not** expose Hermes admin UI or Ollama to the public internet. Use **Tailscale** + SSH keys.

---

## 2. Bootstrap the server

SSH in as root or sudo user, then:

```bash
# Base packages
sudo apt update && sudo apt install -y git curl ca-certificates ufw

# Firewall: SSH only (adjust if you use a non-22 port)
sudo ufw allow OpenSSH
sudo ufw enable

# Dedicated user (recommended)
sudo adduser nami
sudo usermod -aG sudo nami
# Copy your SSH key to ~nami/.ssh/authorized_keys, then:
sudo su - nami
```

### Tailscale (VPS ↔ PC, private mobile-build URL)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4    # note 100.x.x.x — PC will use this for NAMI_BUILD_PC_URL from VPS... 
                   # actually PC URL is PC's tailscale IP, not VPS
```

On **PC**, install Tailscale too. Mobile build uses **PC Tailscale IP** in VPS env (`NAMI_BUILD_PC_URL=http://100.x.x.x:8770`).

---

## 3. Clone linkup_mcp on VPS

```bash
mkdir -p ~/Cursor && cd ~/Cursor
git clone https://github.com/RanneG/linkup_mcp.git
cd linkup_mcp
git pull   # stay current
```

Secrets — **never commit**:

```bash
cp ENV_TEMPLATE.md .env   # reference only; edit .env
nano .env
```

Minimum on VPS `.env`:

```bash
LINKUP_API_KEY=your_linkup_key    # web_search; RAG works without it
# Optional if using cloud LLM via Hermes portal — follow hermes setup
```

Mobile build enqueue (copy same token as PC `.env`):

```bash
# ~/.hermes/.env (see docs/hermes/MOBILE_BUILD_VPS.env.example)
NAMI_BUILD_PC_URL=http://100.x.x.x:8770   # PC Tailscale IP
NAMI_BUILD_TOKEN=same-as-pc
```

---

## 4. Install Hermes

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes --version
hermes doctor
```

First-run wizard:

```bash
hermes setup
```

**Tier A (small VPS):** pick cloud / portal model — skip Ollama.

**Tier B (8GB+ VPS):**

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b
hermes model   # Custom OpenAI-compatible → http://127.0.0.1:11434/v1 → qwen2.5:7b
bash scripts/apply-nami-model-routing.sh
```

---

## 5. One-shot Nami stack

From repo root on VPS:

```bash
cd ~/Cursor/linkup_mcp
bash scripts/install-nami-stack-vps.sh
```

This runs: personality + skills → RAG corpus → linkup MCP → model routing → verify.

---

## 6. Telegram gateway (always on)

Interactive first time:

```bash
hermes gateway setup    # follow prompts — Nami bot token, allowlist
bash scripts/start-nami-gateway.sh
```

**Survive reboot** — pick one:

```bash
# Preferred if Hermes supports it on Linux:
hermes gateway install

# Or systemd user service:
bash scripts/install-nami-gateway-systemd.sh
systemctl --user enable --now nami-hermes-gateway
loginctl enable-linger $USER   # run user services when not logged in
```

Test from phone: message Nami bot → `/reload-mcp` → ask a RAG question.

---

## 7. PC side (unchanged primary dev machine)

| Task | Command |
|------|---------|
| Cursor + MCP | Daily driver |
| Mobile build bridge | `Nami-Build-Bridge.bat` or `Start-NamiBuildBridge.ps1` |
| Bridge listens on Tailscale | PC `.env`: `NAMI_BUILD_HOST=0.0.0.0` |
| Shared secret | Same `NAMI_BUILD_TOKEN` on PC + VPS `~/.hermes/.env` |

Full detail: [MOBILE_BUILD.md](./MOBILE_BUILD.md).

---

## 8. After `git pull` on VPS

```bash
cd ~/Cursor/linkup_mcp
git pull
bash scripts/install-nami-stack-vps.sh
hermes gateway restart
```

---

## 9. Verify

```bash
bash scripts/verify-nami-hermes.sh
```

Expected: gateway running, `hermes mcp test linkup` passes, corpus files under `data/nami-corpus/`.

---

## 10. Security checklist

- [ ] SSH key only — disable password auth
- [ ] UFW: no public 8770/8765/11434
- [ ] Tailscale for VPS↔PC; don't port-forward build bridge to the internet
- [ ] `.env` and `~/.hermes/.env` chmod 600
- [ ] Telegram bot allowlist enabled in Hermes config
- [ ] Separate Koshi profile — never share bot tokens ([NAMI.md](./NAMI.md))

---

## Mac (optional)

If the MacBook is off, **ignore** [MAC_SETUP.md](./MAC_SETUP.md) for runtime. Use Mac only as a portable SSH console to the VPS:

```powershell
# PC ~/.ssh/config
Host nami-vps
  HostName 100.x.x.x
  User nami
```

```bash
ssh nami-vps
hermes
```

---

## Related

- [SETUP.md](./SETUP.md) — doc index
- [STATUS.md](./STATUS.md) — scorecard
- [MOBILE_BUILD_VPS.env.example](./MOBILE_BUILD_VPS.env.example)
