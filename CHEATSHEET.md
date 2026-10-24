## 12. Release flow (branch model + back-merge)

### Branch model
- `fix/*`, `feat/*`, `chore/*` → **`develop`** (short-lived feature branches)
- `develop` → **`main`** (promotion, merge commit)
- `main` → **`develop`** (back-merge — **required, easy to forget**)

### Full cycle for a fix or feature
1. Branch off `develop`: `git switch -c fix/my-fix`
2. Commit with a conventional message: `git commit -m "fix: describe the fix"`
3. PR → `develop`, **squash and merge**
4. **Automatic:** `release.yaml` runs on `develop` push → creates `vX.Y.Z-rc.N` tag + GHCR image
5. PR `develop` → `main`, merge with **"Create a merge commit"** (not squash — preserves RC history)
6. **Automatic:** `release.yaml` runs on `main` push → creates `vX.Y.Z` (stable) tag + GHCR image tagged `latest`
7. **Manual (do not skip):** back-merge `main` → `develop` (below)

### Back-merge (main → develop)
Required after every stable release. Without it, `package.json` and `CHANGELOG.md` diverge between branches, and the next promotion produces conflicts.

```bash
git checkout develop
git pull origin develop
git fetch origin main
git merge origin/main --no-ff -m "chore: back-merge main into develop [skip ci]"
git push origin develop
```

The `[skip ci]` prevents `release.yaml` from re-running on develop (nothing to release — just a sync of `package.json` + `CHANGELOG.md` + the stable tag).

### Branch protection
- `main` and `develop`: require PRs, require checks `build-and-test` + `commitlint`
- **"Do not allow bypassing the above settings": UNCHECKED** — needed for semantic-release's PAT to push `chore(release)` commits
- **"Require approvals": 0** — solo project; higher counts require a second reviewer

### Forcing a Docker rebuild for an existing version
If the Docker job failed but the tag/release already exist:

`Actions → Release → Run workflow` → branch `main` → `force_docker_for_version`: `2.0.1` (just the version — **no prefix**)

The `check_tag` step validates the format and fails fast if it's wrong.