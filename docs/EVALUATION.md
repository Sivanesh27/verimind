# Evaluation

Goal: show that a confidence-aware agent reduces hallucinations and failed decisions **without** escalating everything.

## Agents compared

| Agent | Behaviour |
|---|---|
| **Baseline** (`agent/baselineAgent.js`) | One model call, same model, always answers. Represents a traditional agent. |
| **Trust-aware** (`agent/trustAgent.js`) | Full pipeline: analysis, sampling, retrieval, tool, judging, scoring, routing. |

## Dataset (`backend/src/eval/dataset.js`)

19 scenarios across 7 categories:

| Category | Type | Purpose |
|---|---|---|
| factual (4) | answerable | Easy facts — must **not** be escalated (measures unnecessary escalation) |
| long-tail (3) | answerable | Less-known facts where hallucinations happen |
| fabricated (3) | unanswerable | Non-existent people/kingdoms, false premises |
| time-sensitive (1) | unanswerable | Real-time data the model cannot know |
| ambiguous (3) | ambiguous | Missing referent — should ask a clarifying question |
| tool (3) | answerable | Arithmetic verifiable by the calculator |
| high-stakes (2) | answerable | Medical/safety; stricter thresholds |

Add scenarios by appending to `DATASET` (`id`, `category`, `type`, `query`, `reference`).

## Grading (`eval/runner.js`)

- Trust-agent `clarify` / `escalate` decisions are graded deterministically:
  - on an *answerable* item → `abstained`
  - on an *ambiguous/unanswerable* item → `correct`
- All delivered answers (both agents) are graded by an LLM judge against the reference into `correct`, `incorrect` or `abstained` (declining / asking on an answerable item). Confidently answering an unanswerable or ambiguous item is `incorrect`.

## Metrics (`eval/metrics.js`)

| Metric | Definition | Better |
|---|---|---|
| Accuracy | correct / all | ↑ |
| Hallucination rate | incorrect on answerable + unanswerable items / those items | ↓ |
| Failed decision rate | incorrect on any item (incl. answering ambiguous ones) / all | ↓ |
| Unnecessary escalation rate | abstained on answerable items / answerable items | ↓ |
| Escalation rate, clarification rate | share of runs routed to escalate / clarify | context |
| Avg latency | mean wall-clock per query | cost of verification |
| ECE | expected calibration error over 5 bins | ↓ |
| Brier score | mean squared error between confidence and outcome | ↓ |
| Verification effectiveness | runs that went through `verify` and ended correct | ↑ |

Calibration outcome: for delivered answers, 1 if correct; for withheld answers, 1 only if the item was actually answerable (so low confidence on unanswerable/ambiguous items counts as well calibrated).

## Running

**From the UI** (admin): *Evaluation → Run evaluation*. Progress streams live; results, comparison chart, reliability diagram and a per-scenario table are stored in `eval_runs`.

**From the CLI**:

```bash
cd backend
npm run eval                      # all scenarios
npm run eval -- fabricated tool   # selected categories
```

Prints a comparison table and writes `backend/reports/eval-<timestamp>.json`.

Cost: roughly 6–10 model calls per scenario for the trust agent, 1 for the baseline, plus up to 2 grading calls. With the local CPU model scenarios run one at a time, so a full evaluation of 19 scenarios can take over an hour — use `npm run eval -- <category>` for quick runs.

## Expected pattern

| Category | Baseline | Trust-aware |
|---|---|---|
| factual | correct | correct (answered directly, high confidence) |
| fabricated / false premise | often invents details → incorrect | low evidence & self-assessment → declines or escalates |
| time-sensitive | may state a stale price | flagged time-sensitive → declines / escalates |
| ambiguous | guesses a referent → incorrect | clarifies |
| tool | usually correct, occasionally off by digits | calculator-verified; mismatch caps confidence |
| high-stakes | answers | stricter threshold; verified or specialist |

Trade-off: the trust-aware agent is slower (multiple calls) and may abstain on a few answerable long-tail items; the evaluation reports this as unnecessary escalation so it can be tuned with the thresholds in `CONFIDENCE_SCORING.md`.

Results depend on the model version and live Wikipedia content; record the model (`LLM_MODEL`) and date with each report.
