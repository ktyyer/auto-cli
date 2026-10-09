#!/bin/bash
# Optional PostToolUse observation helper. The shared resolver owns attribution;
# raw tool observations do not create business metrics or invent token/cost data.
helper_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
exec node "$helper_dir/hook-cli.cjs" tool-observation
