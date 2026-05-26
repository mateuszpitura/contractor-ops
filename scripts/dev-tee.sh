#!/usr/bin/env bash
# Run `turbo dev` with colors on the terminal AND a plain-text mirror in
# `.dev-logs/turbo-dev.log`. The file copy is stripped of ANSI escape
# sequences so Claude / other consumers can grep it without colour-code
# noise; the user's terminal still sees the full coloured stream.
#
# Color preservation under `tee`:
#   Most CLIs (turbo, next, pnpm, chalk-based tools) auto-disable colors
#   when stdout is not a TTY. `tee` makes stdout a pipe, killing colors.
#   `FORCE_COLOR=1` is the de-facto opt-out respected by Node/turbo/next.
#   `CLICOLOR_FORCE=1` covers BSD-style tools (sed/grep heritage).
#   `TERM` must be 256-color capable for full palette.
set -euo pipefail
mkdir -p .dev-logs

export FORCE_COLOR=1
export CLICOLOR_FORCE=1
export TERM="${TERM:-xterm-256color}"

# `turbo dev --ui=stream` forces line-buffered output (vs. TUI), making the
# stream `tee`-friendly. Each per-app log line is already prefixed with
# `@app:dev:` by turbo so app boundaries stay visible after stripping.
exec turbo dev --ui=stream 2>&1 \
  | tee >(LC_ALL=C sed -E $'s/\x1b\\[[0-9;]*[a-zA-Z]//g; s/\x1b\\][^\x07]*\x07//g' > .dev-logs/turbo-dev.log)
