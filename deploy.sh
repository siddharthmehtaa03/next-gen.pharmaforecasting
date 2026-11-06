#!/usr/bin/env bash
# Build and publish the prototype to its public Surge link. The source zip is left out of the deployed copy.
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"
pnpm build
rm -f dist/figma-make-app-code.zip
surge dist pharmaforecasting.surge.sh
