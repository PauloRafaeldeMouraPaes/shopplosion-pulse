#!/bin/sh
# SessionStart hook for task-observer (template from references/environments.md, v3.11.x).
# Workspace lives in the repository so observations survive ephemeral cloud sessions.
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
OBS_WORKSPACE="$root/.task-observer"
s=$(ls -d "$HOME"/.claude/plugins/cache/one-skill-to-rule-them-all/task-observer/*/skills/task-observer 2>/dev/null | sort -V | tail -1)
d="$OBS_WORKSPACE/skill-observations"
if [ -z "$s" ] || [ ! -f "$s/SKILL.md" ] || [ ! -f "$s/scripts/new-observation.sh" ]; then
  msg="task-observer is NOT INSTALLED (plugin task-observer@one-skill-to-rule-them-all missing): tell the user in your first reply and offer to install it. Do not invoke it and do not offer a review."
  msg=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\000-\037')
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"; exit 0
fi
open=$(find "$d/observation-log" -maxdepth 1 -name '*.md' -exec grep -l '^status: open$' {} + 2>/dev/null | wc -l | tr -d ' ')
last=$(tr -d '\r' 2>/dev/null < "$d/last-review-date.txt"); last=${last:-never}
msg="Make the first tool call of this session one batched call that both lists the task-observer workspace ($OBS_WORKSPACE) and invokes the task-observer skill; then run its Session Start Protocol. Observation files are created only by scripts/new-observation.sh in the skill directory ($s), never by copying a header."
msg="$msg $open open observations in $d; last review: $last."
if [ "$open" -gt 0 ]; then
  cutoff=$(date -d '7 days ago' +%F 2>/dev/null || date -v-7d +%F)
  case "$last" in
    (never) msg="$msg Offer the review." ;;
    (*) [ "$(printf '%s\n%s\n' "$last" "$cutoff" | sort | head -1)" = "$last" ] && msg="$msg Offer the review." ;;
  esac
fi
msg=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\000-\037')
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
