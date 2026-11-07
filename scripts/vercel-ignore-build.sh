#!/bin/sh
set -eu

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
current="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Skip only when both SHAs are distinct, valid commits in the same ancestry.
# If Vercel supplies the current commit as the previous one, build instead.
[ -n "$previous" ] || exit 1
[ "$previous" != "$current" ] || exit 1
printf "%s" "$previous" | grep -Eq '^[0-9a-f]{40}
if git diff --quiet "$previous" "$current" -- \
  Dockerfile.vercel package.json package-lock.json vercel.json \
  index.html client.html sitemap.xml manifest.webmanifest service-worker.js robots.txt \
  llms.txt llms-full.txt fa0a7deb5d60bdf1260c8174ad8c71db.txt .nojekyll \
  site assets backend database scripts/build-static.mjs scripts/direct-sva-seo-plan.mjs scripts/start-vercel.sh scripts/vercel-ignore-build.sh
then
  echo "No production-impacting changes; skipping Vercel container build."
  exit 0
fi

exit 1
 || exit 1
printf "%s" "$current" | grep -Eq '^[0-9a-f]{40}
if git diff --quiet "$previous" "$current" -- \
  Dockerfile.vercel package.json package-lock.json vercel.json \
  index.html client.html sitemap.xml manifest.webmanifest service-worker.js robots.txt \
  llms.txt llms-full.txt fa0a7deb5d60bdf1260c8174ad8c71db.txt .nojekyll \
  site assets backend database scripts/build-static.mjs scripts/direct-sva-seo-plan.mjs scripts/start-vercel.sh
then
  echo "No production-impacting changes; skipping Vercel container build."
  exit 0
fi

exit 1
 || exit 1
git cat-file -e "${previous}^{commit}" >/dev/null 2>&1 || exit 1
git cat-file -e "${current}^{commit}" >/dev/null 2>&1 || exit 1
git merge-base --is-ancestor "$previous" "$current" || exit 1

if git diff --quiet "$previous" "$current" -- \
  Dockerfile.vercel package.json package-lock.json vercel.json \
  index.html client.html sitemap.xml manifest.webmanifest service-worker.js robots.txt \
  llms.txt llms-full.txt fa0a7deb5d60bdf1260c8174ad8c71db.txt .nojekyll \
  site assets backend database scripts/build-static.mjs scripts/direct-sva-seo-plan.mjs scripts/start-vercel.sh
then
  echo "No production-impacting changes; skipping Vercel container build."
  exit 0
fi

exit 1
