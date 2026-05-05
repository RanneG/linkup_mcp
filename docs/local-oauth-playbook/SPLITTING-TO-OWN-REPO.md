# Publish this playbook as its own GitHub repository

Keeps **linkup_mcp** lean if you only want the docs in a separate place (tiny clone, easy to share).

1. On GitHub: create an empty repo, e.g. **`RanneG/local-oauth-playbook`** (no README).
2. From a temp directory:

   ```bash
   git clone --depth 1 https://github.com/RanneG/linkup_mcp.git
   cd linkup_mcp
   git subtree split -P docs/local-oauth-playbook -b oauth-playbook-only
   cd ..
   git clone https://github.com/RanneG/local-oauth-playbook.git
   cd local-oauth-playbook
   git pull ../linkup_mcp oauth-playbook-only --allow-unrelated-histories
   git push -u origin main
   ```

3. Adjust paths in **README.md** if the default branch is not `main`.

**Simpler:** copy the four files from `docs/local-oauth-playbook/` into a new repo’s root, commit, push.
