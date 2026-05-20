#!/usr/bin/env bash
# Vendor blocks from shadcn-compatible community registries into packages/ui.
# Usage: bash scripts/vendor-registry-blocks.sh
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI_DIR="$ROOT/packages/ui/src/components"
STYLES_FILE="$ROOT/packages/ui/src/styles/registry-css.css"

registry_url() {
  case "$1" in
    magic)    echo "https://magicui.design/r" ;;
    ace)      echo "https://ui.aceternity.com/registry" ;;
    cult)     echo "https://www.cult-ui.com/r" ;;
    origin)   echo "https://originui.com/r" ;;
    tailark)  echo "https://tailark.com/r" ;;
    reui)     echo "https://reui.io/r" ;;
    shadcnio) echo "https://shadcn.io/r" ;;
    *)        echo ""; return 1 ;;
  esac
}

# Each line: <local-folder> <registry-name>
ITEMS=(
  "magic marquee"
  "magic number-ticker"
  "magic border-beam"
  "magic retro-grid"
  "magic shimmer-button"
  "magic animated-beam"
  "magic flickering-grid"
  "ace bento-grid"
  "ace glare-card"
  "ace glowing-effect"
  "ace hero-parallax"
  "ace text-generate-effect"
)

echo "Note: edit packages/ui/src/styles/registry-css.css by hand. The vendor script no longer auto-generates CSS keyframes — Tailwind v4 plus nested CSS structures don't survive a naive jq dump."
echo ""

for line in "${ITEMS[@]}"; do
  folder="${line%% *}"
  name="${line#* }"
  base="$(registry_url "$folder")"
  url="$base/$name.json"

  echo "→ $folder/$name from $url"

  json=$(curl -fsSL "$url")
  out_dir="$UI_DIR/$folder"
  mkdir -p "$out_dir"
  out_file="$out_dir/$name.tsx"

  # Write component file
  echo "$json" | jq -r '.files[0].content' > "$out_file"

  # Rewrite @/ aliases to package-internal relative paths
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' -e "s|from '@/lib/utils'|from '../../lib/utils.js'|g" \
              -e 's|from "@/lib/utils"|from "../../lib/utils.js"|g' \
              -e "s|from '@/hooks/use-mobile'|from '../../hooks/use-mobile.js'|g" \
              -e 's|from "@/hooks/use-mobile"|from "../../hooks/use-mobile.js"|g' \
              -e "s|from '@/components/ui/\([^']*\)'|from '../shadcn/\1.js'|g" \
              -e 's|from "@/components/ui/\([^"]*\)"|from "../shadcn/\1.js"|g' "$out_file"
  fi

  # Surface CSS metadata so a human can hand-write keyframes in registry-css.css
  css_block=$(echo "$json" | jq -r '.css // empty')
  if [[ -n "$css_block" && "$css_block" != "null" ]]; then
    echo "   ↳ block has CSS keyframes — verify registry-css.css coverage"
  fi
  vars_block=$(echo "$json" | jq -r '.cssVars.theme // empty')
  if [[ -n "$vars_block" && "$vars_block" != "null" ]]; then
    echo "   ↳ block has @theme vars — verify registry-css.css coverage"
  fi

done

echo "Done. Verify CSS coverage in $STYLES_FILE"
