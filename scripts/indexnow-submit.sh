#!/usr/bin/env bash
#
# indexnow-submit.sh — Submit drinkware experiment URLs to Bing via IndexNow.
#
# IndexNow lets us tell Bing (and the wider IndexNow network: Yandex, Seznam,
# DuckDuckGo) to (re)crawl URLs without logging into Bing Webmaster Tools.
# Ownership is proven by a key file hosted on the domain.
#
# Usage:
#   ./scripts/indexnow-submit.sh                 # submit every URL in sitemap.xml
#   ./scripts/indexnow-submit.sh /myron-thin     # submit specific path(s)
#   ./scripts/indexnow-submit.sh https://drinkware.picolotales.com/imperial-thin
#
# Run this after deploying page changes so Bing recrawls promptly.

set -euo pipefail

HOST="drinkware.picolotales.com"
KEY="74a6926bcc883e4927c13143c0132770"          # must match experiment/drinkware/<KEY>.txt (hosted at site root)
KEY_LOCATION="https://${HOST}/${KEY}.txt"
SITEMAP_URL="https://${HOST}/sitemap.xml"
ENDPOINT="https://www.bing.com/indexnow"

# Normalize an argument into a full https URL on HOST.
to_url() {
  case "$1" in
    https://*) printf '%s' "$1" ;;
    /*)        printf 'https://%s%s' "$HOST" "$1" ;;
    *)         printf 'https://%s/%s' "$HOST" "$1" ;;
  esac
}

# Build the list of URLs to submit.
urls=()
if [ "$#" -gt 0 ]; then
  for arg in "$@"; do urls+=("$(to_url "$arg")"); done
else
  echo "Reading URLs from ${SITEMAP_URL} ..."
  while IFS= read -r u; do urls+=("$u"); done < <(
    curl -fsS "$SITEMAP_URL" | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g'
  )
fi

if [ "${#urls[@]}" -eq 0 ]; then
  echo "No URLs to submit." >&2
  exit 1
fi

echo "Verifying key file is reachable: ${KEY_LOCATION}"
served="$(curl -fsS "$KEY_LOCATION" || true)"
if [ "$served" != "$KEY" ]; then
  echo "ERROR: key file did not return the expected key (got: '${served}')." >&2
  echo "Ensure experiment/drinkware/${KEY}.txt exists and is deployed." >&2
  exit 1
fi

# Assemble JSON urlList.
url_json=""
for u in "${urls[@]}"; do
  url_json+="\"${u}\","
done
url_json="${url_json%,}"

payload="{\"host\":\"${HOST}\",\"key\":\"${KEY}\",\"keyLocation\":\"${KEY_LOCATION}\",\"urlList\":[${url_json}]}"

echo "Submitting ${#urls[@]} URL(s) to Bing IndexNow:"
printf '  %s\n' "${urls[@]}"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d "$payload")"

echo "Response: HTTP ${code}"
case "$code" in
  200|202) echo "Success — Bing accepted the submission." ;;
  400) echo "Bad request — check the JSON payload." >&2; exit 1 ;;
  403) echo "Forbidden — key not valid / key file not found at keyLocation." >&2; exit 1 ;;
  422) echo "Unprocessable — URLs don't match the host, or key mismatch." >&2; exit 1 ;;
  429) echo "Rate limited — too many requests; try again later." >&2; exit 1 ;;
  *)   echo "Unexpected status." >&2; exit 1 ;;
esac
