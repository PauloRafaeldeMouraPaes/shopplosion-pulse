@AGENTS.md

(task-observer activation block — template of v3.11.0)
Before the first tool call of any session, and before writing or
proposing a plan, invoke the task-observer skill AND run its Session
Start Protocol: loading the skill without running the protocol activates
nothing. Any turn that will involve a tool call counts; do not classify
the session as "too simple" from its opening message. A step you did not
run goes to session-starts.log; the reply carries it, in one line before
the answer, only when the user can act on it (a failed probe, a review or
staged update due, an activation gap). If the skill does not resolve on
this turn, tell
the user in your first reply, never only in a log; say which probe told
you so (the skill listing, or the skill directory on disk), re-check the listing on every later turn that makes a tool call,
and run the protocol the first time it resolves — a "not installed"
verdict holds for one turn. Listed on disk but refused by the Skill tool
("Unknown skill"): read its SKILL.md directly and run the protocol.

After completing each task, list the observation records written this
session in the same turn and append a one-line summary from that listing
to checkpoints.log (ids and titles, or "none logged" followed by one line
per user correction and per incident in the task, each with why it is not
an observation) — never from memory of writing them. The reply names only
what was logged, in one line; "none logged" stays in the file. This is the
backstop: it catches a session in which the skill never ran.

The task-observer workspace for this project is:
  /home/claude/shopplosion-pulse/.task-observer
Every path the skill uses derives from that root, never from the current
working directory.

A subagent dispatched by a session that runs this protocol does not run
it and does not write to the log; it reports its findings to its caller.

Runs that cannot write here or get an approval answered write their output to:
  none
