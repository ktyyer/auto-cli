#!/bin/bash
# PostToolUse metrics logger
# Records tool usage metrics to .auto/runs/<latest>/metrics.json

input=$(cat)

# Extract tool info
tool=$(echo "$input" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);process.stdout.write(j.tool||'')")
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Find latest run directory
latest_run=$(ls -1t .auto/runs 2>/dev/null | grep -v archive | head -1)

if [ -z "$latest_run" ]; then
  # No run directory, skip metrics
  echo "$input"
  exit 0
fi

metrics_file=".auto/runs/$latest_run/metrics.json"

# Initialize metrics file if it doesn't exist
if [ ! -f "$metrics_file" ]; then
  cat > "$metrics_file" <<EOF
{
  "runId": "$latest_run",
  "timestamp": "$timestamp",
  "strategy": "unknown",
  "status": "in_progress",
  "duration": {
    "total": 0,
    "phases": {}
  },
  "tokens": {
    "total": 0,
    "input": 0,
    "output": 0,
    "phases": {}
  },
  "cost": {
    "total": 0.0,
    "model": "unknown",
    "phases": {}
  },
  "tools": {
    "calls": []
  }
}
EOF
fi

# Append tool call record (simplified - full implementation would parse token usage from API)
node -e "
const fs = require('fs');
const metrics = JSON.parse(fs.readFileSync('$metrics_file', 'utf8'));
metrics.tools.calls.push({
  tool: '$tool',
  timestamp: '$timestamp'
});
fs.writeFileSync('$metrics_file', JSON.stringify(metrics, null, 2));
" 2>/dev/null || true

echo "$input"
