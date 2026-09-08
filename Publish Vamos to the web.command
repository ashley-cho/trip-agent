#!/bin/bash
# Trip Agent — double-click to PUBLISH. This one goes live to the world.
#
# Production, not preview: the address stops changing on every deploy, which is
# what makes saved trips survive, and anyone with the link can use it.
#
# A public URL spends your Anthropic key. The app rate-limits per visitor and
# per day and degrades to its offline planner rather than erroring, but the only
# hard ceiling is a spend limit set on the Anthropic account itself. Set one at
# console.anthropic.com before you share the link widely.

cd "$(dirname "$0")" || exit 1
clear

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

hold() { echo; read -n 1 -s -r -p "Press any key to close this window."; echo; }
step() { printf '\n  \033[1m%s\033[0m\n' "$1"; }
die()  { printf '\n  \033[31m%s\033[0m\n' "$1"; hold; exit 1; }

printf '\n  PUBLISH VAMOS\n  -------------\n'

command -v node >/dev/null 2>&1 || die "Node isn't installed. Get it from https://nodejs.org."

# Values in a .env file are often quoted, and dotenv strips the quotes before
# the app ever sees them. A plain `cut` does not, so the last deploy shipped
# "sk-ant-..." with literal quote marks and Anthropic answered 401 on every
# call. Strip quotes and whitespace the way dotenv would.
KEY=$(grep '^ANTHROPIC_API_KEY=' .env.local 2>/dev/null | head -1 | cut -d= -f2- \
      | tr -d '\r\n' \
      | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
            -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

[ -n "$KEY" ] || die "No ANTHROPIC_API_KEY in .env.local."
case "$KEY" in
  sk-ant-*) ;;
  *) die "The key in .env.local doesn't look like an Anthropic key. It starts \"${KEY:0:8}\"." ;;
esac

step "1/5  Checking the key actually works"
# Before spending three minutes on a build. The last two deploys were fine
# builds serving a key Anthropic rejects, and nothing checked until you used it.
CODE=$(curl -s -o /tmp/ta-key.json -w '%{http_code}' --max-time 25 \
  https://api.anthropic.com/v1/messages \
  -H "x-api-key: $KEY" -H 'anthropic-version: 2023-06-01' \
  -H 'content-type: application/json' \
  -d '{"model":"claude-sonnet-5","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}')
if [ "$CODE" != "200" ]; then
  printf '  \033[31mAnthropic answered %s.\033[0m\n' "$CODE"
  sed -n 's/.*"message":"\([^"]*\)".*/  \1/p' /tmp/ta-key.json | head -1
  rm -f /tmp/ta-key.json
  die "Fix the key in .env.local first. A new one: console.anthropic.com -> API keys."
fi
rm -f /tmp/ta-key.json
echo "  Key is good."

V="npx --yes vercel@latest"

# The project's name is the last part of the address, and the address is what
# people bookmark. Renaming it here rather than in the dashboard means the
# stable URL and the code that ships to it can never drift apart.
PROJECT="vamos"

step "2/5  Signing in to Vercel"
if $V whoami >/dev/null 2>&1; then
  echo "  Already signed in as $($V whoami 2>/dev/null)."
else
  echo "  A browser window opens. Approve it, then come back here."
  $V login || die "Login failed."
fi

step "2.5/5  Pointing at the right project"
CURRENT=$(sed -n 's/.*"projectName":"\([^"]*\)".*/\1/p' .vercel/project.json 2>/dev/null)
if [ "$CURRENT" = "$PROJECT" ]; then
  echo "  Already publishing to $PROJECT."
else
  echo "  Linking to \"$PROJECT\" (was \"${CURRENT:-nothing}\")."
  # --yes creates the project when it doesn't exist yet. The old project and
  # its deployments are left alone; nothing is deleted.
  #
  # The error is shown rather than swallowed. A silent link failure here means
  # publishing to the wrong project, which is exactly how a deploy ended up
  # back on "trip-agent" with no sync in it and looked fine from the outside.
  if ! $V link --yes --project "$PROJECT" >/tmp/ta-link.log 2>&1; then
    tail -12 /tmp/ta-link.log
    die "Couldn't link to \"$PROJECT\". The output above says why."
  fi
fi

echo
echo "  Publishing to the project \"$PROJECT\"."
echo

step "3/5  Building and publishing, with the key"
echo "  Two or three minutes the first time."
echo
# The CLI rewrites .env.local with its own copy of the project's development
# variables, which is how the key came back quoted and with a stray OIDC token.
# Your file is yours; put it back afterwards.
cp .env.local /tmp/ta-env-backup 2>/dev/null
# The Supabase URL and publishable key are meant to be public: they ship inside
# the page either way. What keeps one person's trips out of another's is
# row-level security in the database, not the secrecy of these two strings.
SB_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://bzhlpvcoldcqcyctkpsw.supabase.co}"
SB_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_u2g_ZYsKQlBVscxcHrAYeA_Es2k07gv}"

# VISITOR_UNITS is 600 while she is dogfooding, which is about 25 researched
# trips an hour. It was 60, which is two, and she hit it inside three minutes.
# Lower it again before this link goes anywhere wide: the number exists to stop
# one visitor spending the whole Anthropic key.
#
# -e is a RUNTIME variable; -b is a BUILD one. Anything named NEXT_PUBLIC_ is
# baked into the page during the build, so passing it with -e alone means the
# browser gets `undefined` and sync disappears from the UI without any error.
# The API key is the opposite: runtime only, never built into a public page.
URL=$($V --prod --yes \
        -e ANTHROPIC_API_KEY="$KEY" \
        -b NEXT_PUBLIC_SUPABASE_URL="$SB_URL" \
        -b NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SB_KEY" \
        -e NEXT_PUBLIC_SUPABASE_URL="$SB_URL" \
        -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SB_KEY" \
        -e TRIP_AGENT_VISITOR_UNITS="${TRIP_AGENT_VISITOR_UNITS:-600}" \
        -e TRIP_AGENT_DAILY_UNITS="${TRIP_AGENT_DAILY_UNITS:-1500}" \
        -b PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
        2>&1 | tee /tmp/ta-deploy.log | grep -Eo 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)
if [ -f /tmp/ta-env-backup ]; then
  cmp -s /tmp/ta-env-backup .env.local || {
    cp /tmp/ta-env-backup .env.local
    echo "  (Vercel rewrote .env.local; restored yours.)"
  }
  rm -f /tmp/ta-env-backup
fi

if [ -z "$URL" ]; then
  echo
  tail -30 /tmp/ta-deploy.log
  die "Deploy failed, or I couldn't read the url. The log is above."
fi

# The address to hand out is not the one the deploy prints last.
#
# Vercel ends its output with the deployment-specific URL, the one with a hash
# in it, which changes on every publish. The stable alias is shorter and is
# what should be bookmarked. Ask Vercel for this deployment's aliases and take
# the shortest, rather than guessing at the team slug.
ALIAS=$($V inspect "$URL" 2>&1 \
        | grep -Eo '[a-z0-9][a-z0-9.-]*\.vercel\.app' \
        | sort -u | awk '{ print length, $0 }' | sort -n | head -1 | cut -d" " -f2-)
if [ -n "$ALIAS" ] && [ "$ALIAS" != "$(printf '%s' "$URL" | sed 's|https://||')" ]; then
  SHARE="https://$ALIAS"
else
  SHARE="$URL"
fi

step "4/5  Making sure the public can actually open it"
# Vercel's Standard Protection covers preview deployments only, but an account
# set to protect everything would put a login wall in front of the thing you
# just published, and you would not find out until someone told you.
PUB=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SHARE")
case "$PUB" in
  200) echo "  Open to anyone with the link." ;;
  401|403)
    printf '  \033[31mThe live site is behind a login wall (HTTP %s).\033[0m\n' "$PUB"
    echo "  Vercel dashboard -> the trip-agent project -> Settings -> Deployment Protection,"
    echo "  and set Vercel Authentication to Standard Protection (preview only) or Disabled."
    echo "  The deploy itself succeeded; this is only about who can open it." ;;
  *) printf '  Site answered %s. It may still be warming up.\n' "$PUB" ;;
esac

step "4.5/5  Checking sync made it into the page"
# The last deploy looked perfect and shipped a page with no sign-in on it: the
# Supabase values went in as runtime variables, and a NEXT_PUBLIC_ value has to
# exist at build time. Nothing failed, the button just wasn't there. So look.
HOST=$(printf '%s' "$SB_URL" | sed 's|https://||')
SYNC_OK=""
FILES=$(curl -s --max-time 20 "$SHARE" | grep -Eo '/_next/static/[A-Za-z0-9._/-]+\.js' | sort -u | head -40)
for JS in $FILES; do
  if curl -s --max-time 15 "$SHARE$JS" | grep -q "$HOST"; then SYNC_OK=yes; break; fi
done
if [ -n "$SYNC_OK" ]; then
  echo "  Sign-in and cross-device sync are live."
elif [ -z "$FILES" ]; then
  printf '  \033[33mCouldn'"'"'t check: no script files found on the page.\033[0m\n'
  echo "  That is this check being broken, not the site. Open it and look for"
  echo "  \"Sign in to use these trips on your phone\" under your trips."
else
  printf '  \033[31mSync did not make it into this build.\033[0m\n'
  echo "  The site works, but there is no sign-in and trips stay on one device."
fi

step "5/5  Checking the live site answers with the model"
sleep 5
ANSWER=$(curl -s --max-time 60 -X POST "$SHARE/api/agent" \
  -H 'content-type: application/json' \
  -d '{"action":"question","brief":{"opening":"","vibes":[],"constraints":[],"avoidTags":[]},"history":[],"phase":"discovery"}' 2>/dev/null)

case "$ANSWER" in
  *'"driver":"llm"'*)      VERDICT="\033[32mthe model answered\033[0m" ;;
  *'"driver":"fallback"'*) VERDICT="\033[31mthe model failed on the deployment\033[0m" ;;
  *'"driver":"rules"'*)    VERDICT="\033[31mrules only — the key did not reach the deployment\033[0m" ;;
  *)                       VERDICT="\033[33mthe login wall blocked this check, which is expected — open the url and read the pill\033[0m" ;;
esac

echo
printf '  \033[32mShare this:\033[0m %s\n' "$SHARE"
if [ "$SHARE" != "$URL" ]; then
  printf '  This build only: %s\n' "$URL"
fi
printf '  Status: %b\n' "$VERDICT"
echo
echo "  The first address stays the same every time you publish."
echo "  Re-run this file any time to ship changes."
open "$SHARE"
hold
