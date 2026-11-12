#!/usr/bin/env bash
# Build and publish the prototype to its public Surge link.
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"
pnpm build
surge dist pharmaforecasting.surge.sh
