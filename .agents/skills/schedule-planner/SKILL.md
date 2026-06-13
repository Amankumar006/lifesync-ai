---
name: schedule-planner
description: Generates, edits, and validates schedule output for the Personal AI Agent. Use when writing or modifying the build_schedule_node LLM prompt, adjusting how the agent handles weekday vs weekend mode, adding new schedule block types, implementing the HITL approval and edit flow, writing the nightly learning/behavioral inference cron job, or when the schedule output looks wrong (wrong priorities, blocks not respecting user preferences, gym on wrong days). Also use when the user asks about how the agent decides what to schedule.
---

# Schedule Planner Skill

This skill governs the core intelligence of the Personal AI Agent — how it transforms a user's profile, timetable, and task queue into a personalized daily or weekly schedule.

## Schedule Block Types

Always use one of these exact `type` values — the mobile UI maps them to colors:

| type | color | use for |
|------|-------|---------|
| `work` | blue | College classes, internship hours |
| `study` | purple | Study blocks, homework, revision |
| `personal` | green | Wake up, meals, commute, hygiene |
| `health` | orange | Gym, sports, walk, run |
| `rest` | yellow | Nap, breaks, free time |
| `ent` | red | Movie night, gaming, social |

## Weekday vs Weekend Mode

**Weekday Mode** — apply when `datetime.weekday() < 5`:
- Fixed blocks from timetable are non-negotiable
- Study blocks scheduled around classes, not before them (unless user is a morning studier)
- Gym only on user's designated gym days
- Hard sleep target enforced
- No entertainment blocks unless explicitly requested

**Weekend Mode** — apply when `datetime.weekday() >= 5`:
- No fixed class blocks
- Wake up 2–3 hours later than weekday target
- Larger unstructured self-improvement / project block (2–3 hrs)
- Optional nap window in afternoon
- Evening walk suggested
- Movie night block on Saturday (`ent` type, 9–11:30 PM) — curate via TMDB tool
- Flexible sleep (no hard cutoff)

## Build Schedule Prompt — Complete Template

```python
SCHEDULE_PROMPT = """
You are a personal AI scheduler. Build a realistic, personalized schedule for {date} ({weekday}).

═══════════════════════════════════════════
FIXED BLOCKS — DO NOT MOVE OR REMOVE
═══════════════════════════════════════════
{timetable_classes}

═══════════════════════════════════════════
USER PROFILE
═══════════════════════════════════════════
Role: {role}
Wake time target: {wake_time} (actual avg: {actual_wake_avg})
Sleep target: {sleep_target}
Peak focus time: {peak_focus_time}
Study block length: {study_block_pref}
Gym days: {gym_days} at {gym_time}
Mode: {current_mode}

═══════════════════════════════════════════
BEHAVIORAL PATTERNS (learned)
═══════════════════════════════════════════
{reschedule_patterns}
Example: gym_monday: 0.8 means they skip gym 80% of Mondays — don't schedule gym today if it's Monday.

═══════════════════════════════════════════
TASK QUEUE (sorted by deadline)
═══════════════════════════════════════════
{task_queue}

═══════════════════════════════════════════
USER FEEDBACK ON PREVIOUS PROPOSAL
═══════════════════════════════════════════
{human_feedback}
(Apply these edits exactly. If empty, ignore.)

═══════════════════════════════════════════
RULES
═══════════════════════════════════════════
1. Never schedule two blocks at the same time
2. Add 15-min buffer before every Fixed Block for preparation
3. Prioritize tasks by deadline proximity, not just priority label
4. Never schedule deep study within 30 min of a meal
5. If today is a gym day AND skip_probability < 0.6, include gym
6. In weekend mode, add movie block at 21:30 on Saturday only
7. Always end with a sleep block at sleep_target

Return ONLY a JSON array. No markdown, no explanation:
[
  {
    "time": "HH:MM",
    "title": "Block title",
    "type": "work|study|personal|health|rest|ent",
    "duration_min": 60,
    "notes": "Context or reminder text shown to user"
  }
]
"""
```

## HITL — User Approval & Edit Flow

After `propose_schedule` is interrupted by LangGraph, the mobile app shows the schedule and collects feedback. The feedback object sent back to resume the graph:

```python
# Approved — no changes:
{"approved": True, "edits": []}

# Rejected with edits — agent rebuilds:
{
    "approved": False,
    "edits": [
        {"action": "move", "block": "Gym Session", "new_time": "19:00"},
        {"action": "remove", "block": "Evening Walk"},
        {"action": "add", "block": {"time": "22:00", "title": "Extra Study", "type": "study", "duration_min": 60}}
    ]
}
```

In `build_schedule_node`, include `human_feedback.edits` in the prompt when rebuilding.

## Nightly Learning Node (Cron)

This runs outside the main graph as a background FastAPI task — not a graph node.
Schedule it with APScheduler at 11:59 PM daily per user.

```python
# Logic: read today's schedule from Firestore
# Compare "approved_schedule" blocks with "completed" flags
# For each skipped block: update skip_probability in LangGraph Store
# For each extended block: note the extension pattern

async def nightly_learning(user_id: str, store: BaseStore):
    namespace = ("users", user_id, "habits")
    # ... fetch today's schedule outcomes from Firestore
    # ... update Store with behavioral signals
    # Example update:
    profile = await load_user_profile(store, user_id)
    patterns = profile.get("reschedule_patterns", {})
    # If gym was skipped today:
    if gym_skipped:
        key = f"gym_{weekday.lower()}"
        patterns[key] = min(patterns.get(key, 0) + 0.1, 1.0)
    profile["reschedule_patterns"] = patterns
    await save_user_profile(store, user_id, profile)
```

## Priority Resolution — When Two Tasks Conflict for the Same Slot

Use this decision order:
1. Earlier deadline wins
2. `critical` priority overrides `high` regardless of deadline
3. User's explicitly stated preferences override the above
4. If truly tied, ask the user (HITL clarification)

## Week-Level Scheduling

When `intent_scope == "week"`, loop over 7 days and run `build_schedule_node` per day. Apply cross-day constraints:
- If an exam is on Friday: add a 2-hr revision block on Thursday night
- If an assignment is due Wednesday: increase study priority Mon + Tue
- Gym days are fixed across the week — don't move them between days
- Weekend movie only on Saturday — not Sunday
