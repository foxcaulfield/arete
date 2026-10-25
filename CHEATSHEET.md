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

```
branch ──PR──► develop (auto: X.Y.Z-rc.N) ──PR──► main (auto: X.Y.Z) ──back-merge──► develop
```

---

## 13. UI conventions — Skeleton v3

### Use `<Button>` for every preset-styled button

```svelte
import Button from "$lib/components/common/Button.svelte";

<Button
    text="Save"
    type="submit"
    preset="filled"    // filled | outlined | tonal | ghost
    color="primary"    // primary | secondary | tertiary | success | warning | error | surface
    size="sm"          // sm | base | lg
    loading={submitting}
    disabled={isDisabled}
    onclick={handleClick}
/>
```

The `<Button>` component encodes the **correct** class mapping for every preset+color combination. Hand-typing Skeleton classes leads to these traps:

| Wrong (silently broken)    | Correct                     | Why                                              |
| :------------------------- | :-------------------------- | :----------------------------------------------- |
| `preset-tonal-surface-500` | `preset-tonal-surface`      | Tonal has **no shade suffix** in v3              |
| `preset-tonal-primary-500` | `preset-tonal-primary`      | Same — the shade doesn't exist, class is a no-op |
| `variant-filled-error`     | `preset-filled-error-500`   | `variant-` is v2 syntax                          |
| `variant-filled-primary`   | `preset-filled-primary-500` | Same                                             |

When a raw `<button class="btn preset-...">` is wrong, the button still gets `.btn` (padding + cursor) but loses its background/border → **looks like plain text**. That's the symptom to watch for.

### When to keep raw `<button>`

| Case                                       | Example                                                                |
| :----------------------------------------- | :--------------------------------------------------------------------- |
| Text-link style (underline, no background) | `class="mt-4 text-sm underline"` on the Auth toggle                    |
| Inline icon action (✕ clear, "Copy")       | `class="absolute top-2 right-2 text-surface-400 hover:bg-surface-700"` |
| Inside a Skeleton compound component       | `<Dialog.Trigger>` — Skeleton owns the element                         |

Rule of thumb: **if it would look right as `class="btn preset-..."`, use `<Button>`. If it wouldn't, keep raw.**

### Audit command

Run after adding any raw preset button, or periodically:

```bash
grep -rn "preset-tonal-[a-z]*-[0-9]" front-end/src/
grep -rn "variant-" front-end/src/
```

Both should return nothing. Any output is a broken class.

---

### Which button abstraction to use

| Looks like                                       | Use                                                                          |
| :----------------------------------------------- | :--------------------------------------------------------------------------- |
| Filled / outlined / tonal / ghost preset button  | `<Button preset="..." color="..." size="..." />`                             |
| Icon-only square button (✕, →, ⌄)                | `<Button icon useIcon IconComponent={...} preset="ghost" color="surface" />` |
| Text link with color (Copy, Undo, Clear all)     | raw `<button class="text-xs text-primary-500 hover:text-primary-400">`       |
| Text link with permanent underline (Auth toggle) | raw `<button class="text-sm underline">`                                     |
| Dialog trigger (`Dialog.Trigger`)                | leave as-is — Skeleton owns the element                                      |

**Rule:** if it needs `class="btn preset-..."`, use `<Button>`. If it doesn't, don't force it.

---

### Skeleton v3 TagsInput — customizing tag appearance

`TagsInput.ItemPreview` ships with **button-sized padding** (`padding-block` and `padding-inline` computed from `--btn-size`). This makes tags look like pills by default.

To make them compact chips: **put your classes directly on `ItemPreview`** and skip the inner `<div>`. Tailwind utilities in `@layer utilities` override Skeleton's `@layer base` styles.

```svelte
<TagsInput.ItemPreview class="gap-1 rounded border border-success-700 bg-success-900 px-1.5 py-0.5">
    <span class="text-xs text-surface-100">{value}</span>
    <TagsInput.ItemDeleteTrigger class="cursor-pointer text-success-600 hover:text-success-500" />
</TagsInput.ItemPreview>
```

If padding still looks wrong (logical-property conflict in some Tailwind v4 builds), add to `app.css`:

```css
@layer utilities {
	[data-scope="tags-input"][data-part="item-preview"] {
		padding-block: 0;
		padding-inline: 0;
		gap: 0;
	}
}
```

---
