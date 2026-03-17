#!/bin/bash
# deploy.sh — One-shot Vercel deploy for Kyron Medical
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e  # exit on any error

NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Kyron Medical — Deploy to Vercel   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Check required tools ─────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found. Run: nvm use 24"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm not found."; exit 1; }

# ── Step 2: Install dependencies ─────────────────────────────────────────────
echo "▶ Installing dependencies..."
npm install --legacy-peer-deps

# ── Step 3: Type check ────────────────────────────────────────────────────────
echo "▶ Running TypeScript check..."
npx tsc --noEmit && echo "  ✓ TypeScript OK"

# ── Step 4: Build ─────────────────────────────────────────────────────────────
echo "▶ Building..."
npm run build && echo "  ✓ Build OK"

# ── Step 5: Git commit ────────────────────────────────────────────────────────
echo ""
echo "▶ Git status:"
git status --short

echo ""
read -p "Commit message (or press Enter for default): " COMMIT_MSG
COMMIT_MSG="${COMMIT_MSG:-feat: deploy kyron medical patient portal}"

git add -A
git commit -m "$COMMIT_MSG" || echo "  (nothing new to commit)"

# ── Step 6: Push to GitHub ────────────────────────────────────────────────────
echo ""
read -p "GitHub repo URL (e.g. https://github.com/username/kyron-medical-agent.git): " REPO_URL

if [ -n "$REPO_URL" ]; then
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REPO_URL"
    git push -u origin main
    echo "  ✓ Pushed to GitHub"
else
    echo "  (skipped — no repo URL provided)"
fi

# ── Step 7: Vercel deploy ─────────────────────────────────────────────────────
echo ""
echo "▶ Deploying to Vercel..."

if ! command -v vercel >/dev/null 2>&1; then
    echo "  Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy to production
vercel --prod

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  DEPLOY COMPLETE                                        ║"
echo "║                                                          ║"
echo "║  Next steps:                                             ║"
echo "║  1. Copy your Vercel URL                                 ║"
echo "║  2. Go to Vercel dashboard → Settings → Env Variables    ║"
echo "║     Add all vars from .env.local                         ║"
echo "║  3. Vapi dashboard → Assistant → Server URL:             ║"
echo "║     https://YOUR-APP.vercel.app/api/vapi-webhook         ║"
echo "║  4. Vapi dashboard → Phone Number → Server URL:          ║"
echo "║     https://YOUR-APP.vercel.app/api/vapi-inbound         ║"
echo "║  5. Update NEXT_PUBLIC_APP_URL in Vercel env vars        ║"
echo "║  6. Redeploy once after adding env vars                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
