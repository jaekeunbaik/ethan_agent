---
description: Automatically stage, commit, and push code changes to remote Git repository after file modifications.
---

// turbo-all

# Automated Git Commit and Push Workflow

Whenever file modifications, bug fixes, SEO updates, or feature updates are completed in a project, automatically commit and push the changes to GitHub without waiting for manual commands.

## Workflow Rules & Guidelines

1. **Automatic Execution**: Always stage, commit, and push immediately after completing requested code edits unless specifically instructed otherwise.
2. **Commit Message Format**: Use clear Korean or standard conventional commit prefixes (`seo:`, `feat:`, `fix:`, `style:`, `refactor:`).
3. **Workspace Path Handling**: Use `git -C <repo_path>` to ensure commands target the correct repository even across workspace subdirectories.

## Execution Steps

1. Check current repository status:
```powershell
git -C <repo_path> status
```

2. Stage all modified and added files:
```powershell
git -C <repo_path> add .
```

3. Create commit with concise message:
```powershell
git -C <repo_path> commit -m "<commit message>"
```

4. Push to remote repository:
```powershell
git -C <repo_path> push
```
