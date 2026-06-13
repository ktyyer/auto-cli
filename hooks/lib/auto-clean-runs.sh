#!/bin/bash
# Auto-clean old runs: 自动归档超过阈值天数的 run
# 由 SessionStart Hook 调用，每次会话启动时自动检查

set -euo pipefail

# 配置项（可通过环境变量覆盖）
RETENTION_DAYS="${AUTO_CLEAN_RETENTION_DAYS:-30}"
DRY_RUN="${AUTO_CLEAN_DRY_RUN:-false}"
RUNS_DIR="${AUTO_RUNS_DIR:-.auto/runs}"
ARCHIVE_DIR="${RUNS_DIR}/archive"

# 确保在 Git 仓库中
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# 确保 runs 目录存在
if [ ! -d "$RUNS_DIR" ]; then
  exit 0
fi

# 计算阈值时间戳（当前时间 - RETENTION_DAYS）
if command -v date >/dev/null 2>&1 && date -d "30 days ago" +%s >/dev/null 2>&1; then
  # GNU date (Linux, Git Bash)
  current_ts=$(date +%s)
  threshold_ts=$(date -d "$RETENTION_DAYS days ago" +%s)
elif command -v date >/dev/null 2>&1 && date -v-30d +%s >/dev/null 2>&1; then
  # BSD date (macOS)
  current_ts=$(date +%s)
  threshold_ts=$(date -v-${RETENTION_DAYS}d +%s)
else
  # 跨平台降级：使用 node/python 计算时间戳
  if command -v node >/dev/null 2>&1; then
    current_ts=$(node -e "console.log(Math.floor(Date.now()/1000))")
    threshold_ts=$(node -e "console.log(Math.floor(Date.now()/1000) - $RETENTION_DAYS * 86400)")
  elif command -v python3 >/dev/null 2>&1; then
    current_ts=$(python3 -c "import time; print(int(time.time()))")
    threshold_ts=$(python3 -c "import time; print(int(time.time()) - $RETENTION_DAYS * 86400)")
  else
    echo "[Auto-clean] WARNING: No compatible date/node/python3 found, skip cleaning" >&2
    exit 0
  fi
fi

archived_count=0
skipped_count=0

# 遍历所有 run 目录
for run_dir in "$RUNS_DIR"/run-*; do
  # 跳过不存在的匹配（glob 未命中时）
  [ -d "$run_dir" ] || continue

  # 跳过 archive 目录本身
  [[ "$run_dir" == *"/archive" ]] && continue

  run_name=$(basename "$run_dir")

  # 提取时间戳（支持两种格式）
  # 格式 1: run-<unix_timestamp> (e.g., run-1776525672)
  # 格式 2: run-<YYYYMMDD>-<description> (e.g., run-20260521-local-verify)
  if [[ "$run_name" =~ ^run-([0-9]{10})$ ]]; then
    # 格式 1: 直接使用 Unix 时间戳
    run_ts="${BASH_REMATCH[1]}"
  elif [[ "$run_name" =~ ^run-([0-9]{8})- ]]; then
    # 格式 2: 解析 YYYYMMDD，跨平台兼容
    date_str="${BASH_REMATCH[1]}"
    year="${date_str:0:4}"
    month="${date_str:4:2}"
    day="${date_str:6:2}"

    # 跨平台日期转时间戳
    if command -v date >/dev/null 2>&1 && date -d "$year-$month-$day" +%s >/dev/null 2>&1; then
      # GNU date
      run_ts=$(date -d "$year-$month-$day" +%s 2>/dev/null || echo 0)
    elif command -v date >/dev/null 2>&1 && date -j -f "%Y-%m-%d" "$year-$month-$day" +%s >/dev/null 2>&1; then
      # BSD date (macOS)
      run_ts=$(date -j -f "%Y-%m-%d" "$year-$month-$day" +%s 2>/dev/null || echo 0)
    elif command -v node >/dev/null 2>&1; then
      # Node.js 降级
      run_ts=$(node -e "console.log(Math.floor(new Date('$year-$month-$day').getTime()/1000))")
    elif command -v python3 >/dev/null 2>&1; then
      # Python 降级
      run_ts=$(python3 -c "import time; print(int(time.mktime(time.strptime('$year-$month-$day', '%Y-%m-%d'))))")
    else
      run_ts=0
    fi
  else
    # 无法解析时间戳，跳过
    skipped_count=$((skipped_count + 1))
    continue
  fi

  # 跳过解析失败的 run
  if [ "$run_ts" -eq 0 ]; then
    skipped_count=$((skipped_count + 1))
    continue
  fi

  # 检查是否超过阈值
  if [ "$run_ts" -lt "$threshold_ts" ]; then
    # 创建 archive 目录（如果不存在）
    mkdir -p "$ARCHIVE_DIR"

    age_days=$(( (current_ts - run_ts) / 86400 ))

    if [ "$DRY_RUN" = "true" ]; then
      echo "[DRY RUN] Would archive: $run_name (age: $age_days days)" >&2
    else
      # 移动到 archive
      mv "$run_dir" "$ARCHIVE_DIR/"
      echo "[Auto-clean] Archived: $run_name (age: $age_days days)" >&2
    fi
    archived_count=$((archived_count + 1))
  fi
done

# 输出摘要（仅在有归档时）
if [ "$archived_count" -gt 0 ]; then
  if [ "$DRY_RUN" = "true" ]; then
    echo "[Auto-clean] DRY RUN: Would archive $archived_count run(s) older than $RETENTION_DAYS days" >&2
  else
    echo "[Auto-clean] Archived $archived_count run(s) older than $RETENTION_DAYS days to $ARCHIVE_DIR" >&2
    echo "[Auto-clean] Recover with: mv $ARCHIVE_DIR/run-<id> $RUNS_DIR/" >&2
  fi
elif [ "$skipped_count" -gt 0 ]; then
  echo "[Auto-clean] Skipped $skipped_count run(s) (unable to parse timestamp)" >&2
fi

exit 0
