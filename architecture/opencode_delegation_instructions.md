# opencode delegation instructions

Before launching anything:

- Ensure prompt files exist:
  - `/tmp/$PROJECT_NAME/prompts/coder.md`
  - `/tmp/$PROJECT_NAME/prompts/reviewer.md`
- If either is missing, stop and ask the user. Otherwise, generate ones yourself appropriate for this project and use them
- Create log directory:

```bash
mkdir -p /tmp/$PROJECT_NAME
```

## Worktree reset before coder launch

Each ticket must have a worktree that has to be created beforehand so the agent lands in clean territory:

```bash
~/src/$PROJECT_NAME/.worktrees/$TICKET
```

Before launching a coder, reset the branch to current `$BRANCH`:

```bash
cd ~/src/$PROJECT_NAME/.worktrees/$TICKET
git fetch origin
git reset --hard origin/$BRANCH
```

Do **not** reset on coder resume calls.

## Logs and session files

For each ticket:

```bash
/tmp/$PROJECT_NAME/$TICKET.md
/tmp/$PROJECT_NAME/$TICKET.ndjson
/tmp/$PROJECT_NAME/$TICKET.coder.session
/tmp/$PROJECT_NAME/$TICKET.reviewer.session
```

The `.md` file is the human-readable live log.

The `.ndjson` file is the raw opencode event stream.

## Launch coder

```bash
TICKET=M7-<N>
WORKTREE=~/src/$PROJECT_NAME/.worktrees/$TICKET

( cd $WORKTREE && git fetch origin && git reset --hard origin/$PROJECT_NAME )

{
  echo "=== CODER $TICKET — $(date -Iseconds) ==="
} >> /tmp/$PROJECT_NAME/$TICKET.md

opencode run \
  --format json \
  --dangerously-skip-permissions \
  --dir $WORKTREE \
  --model "codexbal/gpt-5.5" \
  "$(cat /tmp/$PROJECT_NAME/prompts/coder.md)" \
| tee -a /tmp/$PROJECT_NAME/$TICKET.ndjson \
| jq -r --unbuffered '
    if .type == "step_start" then "▶ step \(.timestamp | tostring)"
    elif .type == "reasoning" then "💭 " + (.part.text // "")
    elif .type == "text" then (.part.text // "")
    elif .type == "tool_use" then "→ " + .part.tool + ": " +
         (.part.state.input.description //
          .part.state.input.command //
          .part.state.input.file_path //
          "")
    elif .type == "step_finish" then "◀ step done (tokens: \(.part.tokens.total))"
    else empty end' \
>> /tmp/$PROJECT_NAME/$TICKET.md

grep -o '"sessionID":"[^"]*"' /tmp/$PROJECT_NAME/$TICKET.ndjson \
  | tail -1 | sed 's/.*"sessionID":"\([^"]*\)".*/\1/' \
  > /tmp/$PROJECT_NAME/$TICKET.coder.session
```

## Launch reviewer

Run after the coder finishes.

```bash
{
  echo ""
  echo "=== REVIEWER $TICKET — $(date -Iseconds) ==="
} >> /tmp/$PROJECT_NAME/$TICKET.md

opencode run \
  --format json \
  --dangerously-skip-permissions \
  --dir $WORKTREE \
  --model "ollama-cloud/deepseek-v4-pro" \
  "$(cat /tmp/$PROJECT_NAME/prompts/reviewer.md)" \
| tee -a /tmp/$PROJECT_NAME/$TICKET.ndjson \
| jq -r --unbuffered '
    if .type == "step_start" then "▶ step \(.timestamp | tostring)"
    elif .type == "reasoning" then "💭 " + (.part.text // "")
    elif .type == "text" then (.part.text // "")
    elif .type == "tool_use" then "→ " + .part.tool + ": " +
         (.part.state.input.description //
          .part.state.input.command //
          .part.state.input.file_path //
          "")
    elif .type == "step_finish" then "◀ step done (tokens: \(.part.tokens.total))"
    else empty end' \
>> /tmp/$PROJECT_NAME/$TICKET.md

grep -o '"sessionID":"[^"]*"' /tmp/$PROJECT_NAME/$TICKET.ndjson \
  | tail -1 | sed 's/.*"sessionID":"\([^"]*\)".*/\1/' \
  > /tmp/$PROJECT_NAME/$TICKET.reviewer.session
```

## Resume coder after review fixes

Use this only when reviewer says `changes-requested`.

```bash
CODER_SESSION=$(cat /tmp/$PROJECT_NAME/$TICKET.coder.session)

{
  echo ""
  echo "=== CODER RESUME $TICKET — $(date -Iseconds) ==="
} >> /tmp/$PROJECT_NAME/$TICKET.md

opencode run \
  --format json \
  --dangerously-skip-permissions \
  --session $CODER_SESSION \
  --dir $WORKTREE \
  --model "codexbal/gpt-5.5" \
  "The reviewer found the following must-fix issues. Address them, re-run the verification gates, then commit. Do not rename the ticket file (it is already at \$TICKET.review.md). Findings:

<paste the must-fix bullets from the review verbatim>" \
| tee -a /tmp/$PROJECT_NAME/$TICKET.ndjson \
| jq -r --unbuffered '
    if .type == "step_start" then "▶ step \(.timestamp | tostring)"
    elif .type == "reasoning" then "💭 " + (.part.text // "")
    elif .type == "text" then (.part.text // "")
    elif .type == "tool_use" then "→ " + .part.tool + ": " +
         (.part.state.input.description //
          .part.state.input.command //
          .part.state.input.file_path //
          "")
    elif .type == "step_finish" then "◀ step done (tokens: \(.part.tokens.total))"
    else empty end' \
>> /tmp/$PROJECT_NAME/$TICKET.md
```

After resume completes, launch a **fresh reviewer session** again. Loop until approved.

## Parallel tickets

For parallel tickets, wrap the launch block in:

```bash
( ... ) &
```

Then:

```bash
wait
```

Each ticket must have its own worktree and log files.

## Tail progress

Single ticket:

```bash
tail -f /tmp/$PROJECT_NAME/M7-<N>.md
```

Parallel band:

```bash
tail -f /tmp/$PROJECT_NAME/M7-{5,6,7,8,9}.md
```

## Decision loop

For each ticket:

1. Check `/tmp/$PROJECT_NAME/$TICKET.status`.
2. Skip if already `approved`.
3. Reset worktree to `origin/$PROJECT_NAME`.
4. Launch coder.
5. Verify:
   - ticket file renamed `.md` → `.review.md`
   - branch has at least one commit ahead of `origin/$PROJECT_NAME`
   - coder closing summary appears in `/tmp/$PROJECT_NAME/$TICKET.md`
6. Launch reviewer.
7. Read verdict from ticket review file.
8. If `approved`, write:

```bash
echo approved > /tmp/$PROJECT_NAME/$TICKET.status
```

9. If `changes-requested`, resume coder with exact must-fix bullets.
10. Re-review with a fresh reviewer session.
11. Cap at 3 review iterations.
12. If `rejected`, escalate to user.

## Do not

- Do not edit production code yourself.
- Do not skip reviewer.
- Do not launch dependent tickets while current ticket is unresolved.
- Do not reset worktree during coder resume.
- Do not vaguely ask coder to “fix review”; paste exact must-fix bullets.
- Do not push or open PRs.
