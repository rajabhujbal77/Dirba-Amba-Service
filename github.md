# GitHub Workflow Guide

## Repository Setup

This project uses **two GitHub repositories** for development and production:

| Remote | Repository | Purpose |
|--------|------------|---------|
| `origin` | [GD-Mango/Mangotransportwebsite](https://github.com/GD-Mango/Mangotransportwebsite/) | Development backup |
| `production` | [rajabhujbal77/Dirba-Amba-Service](https://github.com/rajabhujbal77/Dirba-Amba-Service) | Production (Cloudflare Pages) |

**Live Website:** [dirbaambaservice.in](https://dirbaambaservice.in) (deployed via Cloudflare Pages)

---

## Daily Workflow

### 1. Start Development
```bash
# Navigate to project
cd "c:\Users\Compu Care\Desktop\Projects\Mango-figma\Mangotransportwebsite"

# Start dev server
npm run dev
```

### 2. Make Changes & Commit
```bash
# Check what files changed
git status

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: description of what you added"
```

### 3. Push to Both Repositories
```bash
# Push to your GitHub (backup)
git push origin main

# Push to production (triggers Cloudflare deployment)
git push production main
```

---

## Commit Message Guidelines

Use these prefixes for clear history:

| Prefix | Use For | Example |
|--------|---------|---------|
| `feat:` | New features | `feat: add customer search` |
| `fix:` | Bug fixes | `fix: correct price calculation` |
| `docs:` | Documentation | `docs: update README` |
| `style:` | Formatting | `style: fix indentation` |
| `refactor:` | Code restructure | `refactor: simplify booking logic` |
| `chore:` | Maintenance | `chore: update dependencies` |

---

## Common Commands

| Task | Command |
|------|---------|
| Check status | `git status` |
| View commit history | `git log --oneline -10` |
| View all remotes | `git remote -v` |
| Pull latest changes | `git pull origin main` |
| Discard local changes | `git checkout -- .` |
| Create new branch | `git checkout -b feature-name` |

---

## Deployment Flow

```
Local Changes → git push production main → GitHub → Cloudflare Pages → dirbaambaservice.in
```

Cloudflare Pages automatically:
1. Detects new commits on `main` branch
2. Runs `npm run build`
3. Deploys to dirbaambaservice.in

---

## Troubleshooting

### Permission Denied Error
```
remote: Permission denied to GD-Mango
```
**Solution:** Ensure `GD-Mango` is added as collaborator at:
https://github.com/rajabhujbal77/Dirba-Amba-Service/settings/access

### Merge Conflicts
```bash
# Pull and merge
git pull origin main

# After resolving conflicts in files
git add .
git commit -m "fix: resolve merge conflicts"
git push origin main
```

### Reset to Last Commit
```bash
# Discard all uncommitted changes
git checkout -- .
git clean -fd
```

---

## Quick Reference Card

```bash
# Full deployment workflow
git add .
git commit -m "your message"
git push origin main
git push production main
```

---

*Last updated: January 10, 2026*
