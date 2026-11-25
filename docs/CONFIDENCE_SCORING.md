# Confidence scoring

Source: `backend/src/agent/confidence.js`, `backend/src/agent/router.js`, `backend/src/agent/trustAgent.js` (`buildSignals`).

## 1. Signals

Each signal is a number in `[0, 1]`, or `null` when it does not apply.

| Signal | Weight | How it is measured |
|---|---|---|
| `selfAssessment` | 0.15 | The answering model's verbalised probability of being correct (prompted for calibration; told to give low confidence for unknown entities and time-sensitive facts). |
| `consistency` | 0.25 | Two extra independent reasoning attempts are sampled; an LLM judge rates substantive agreement among the three answers. |
| `evidence` | 0.25 | Wikipedia passages for the analyzer's search queries; an LLM fact-checker rates support. Contradiction → capped at 0.2. No relevant evidence (and no tool) → 0.4 (weak, not neutral). |
| `sourceReliability` | 0.10 | Mean reliability of relevant sources (Wikipedia = 0.8, calculator = 1.0). |
| `toolVerification` | 0.30 | When the query is a computation, a sandboxed calculator evaluates the analyzer's expression. Match with the answer's `numeric_answer` → 1, mismatch → 0. |
| `clarity` | 0.15 | `1 − ambiguity` from query analysis. |

Self-assessment alone is a weak signal (LLMs are over-confident), so it has the lowest weight; externally grounded signals (tools, evidence, consistency) dominate.

## 2. Aggregation

```
score = Σ(weight_i · value_i) / Σ(weight_i)     over available signals
```

Unavailable signals are dropped and the remaining weights re-normalised, so a pure-math question is scored on tool + consistency + clarity + self-assessment.

### Hard caps

A single decisive red flag must not be averaged away:

| Condition | Cap |
|---|---|
| Tool verification failed (`toolVerification = 0`) | 0.30 |
| Evidence contradicts a key claim | 0.40 |
| Query clarity < 0.4 | 0.45 |
| Self-consistency < 0.35 | 0.50 |

Caps are returned with the score and shown in the UI ("Capped at 30%: Tool verification contradicted the answer").

## 3. Levels and thresholds

| Level | Default threshold | Env var |
|---|---|---|
| high | score ≥ 0.80 | `CONFIDENCE_HIGH` |
| medium | score ≥ 0.55 | `CONFIDENCE_MEDIUM` |
| low | otherwise | |

**High-stakes queries** (medical, legal, financial, safety) need `high + 0.10` (max 0.95) to count as high, so they are verified more often.

## 4. Routing

| Level | Context | Route |
|---|---|---|
| high | — | `answer` |
| medium | not yet verified | `verify` |
| medium | verified | `answer` |
| low | ambiguity ≥ 0.5 and a clarifying question exists | `clarify` |
| low | not yet verified | `verify` (one grounded retry) |
| low | specialist domain, specialist not yet consulted | `specialist` |
| low | otherwise | `escalate` |

Extra short-circuit: if ambiguity ≥ 0.75 on the first turn, the agent asks the clarifying question **before** spending calls on an answer. The user's reply is sent with `parentRunId`, and the agent sees the original question, its clarifying question and the reply.

**Verify** = search Wikipedia for the draft's key claims → re-answer with all evidence and tool results in context → re-judge evidence and consistency (agreement between grounded and original answer, blended with the original sampling agreement) → re-score.

**Specialist** = a domain-specific system prompt (medical, legal, financial, safety, technical, general research) answers with the gathered evidence; its answer is re-judged and re-scored. If it reaches medium/high the route is reported as `specialist`.

## 5. Explanations

`explainConfidence` maps signals to plain-language factors, sorted by severity (`high` → `medium` → `low` → `positive`):

| Code | Label | Trigger |
|---|---|---|
| `AMBIGUOUS_QUERY` | Ambiguous query | clarity < 0.7 |
| `MISSING_INFORMATION` | Missing information | the answer lists missing information |
| `CONFLICTING_EVIDENCE` | Conflicting evidence | evidence contradicts a key claim |
| `NO_SUPPORTING_EVIDENCE` | No supporting source found | retrieved sources were irrelevant |
| `WEAK_EVIDENCE` | Weak evidence | evidence support < 0.5 |
| `LOW_SOURCE_RELIABILITY` | Low source reliability | reliability < 0.6 |
| `FAILED_VERIFICATION` | Failed verification | calculator disagrees (or could not run) |
| `INCONSISTENT_REASONING` | Inconsistent reasoning | consistency < 0.6 (lists divergent points) |
| `LOW_SELF_ASSESSMENT` | Model unsure | self-assessment < 0.5 |
| `TIME_SENSITIVE` | Time-sensitive question | depends on real-time / recent data |
| `HIGH_STAKES` | High-stakes (domain) | stricter threshold applied |
| `MODEL_DECLINED` | Model declined | LLM refusal |
| `SUPPORTED_BY_EVIDENCE` / `VERIFIED_BY_TOOL` / `CONSISTENT_REASONING` | positive | reasons for trust |

## 6. Tuning

- Change thresholds with env vars — no code change needed.
- Change weights in `WEIGHTS` (`confidence.js`); unit tests in `backend/tests/confidence.test.js` lock in the intended behaviour.
- Use the evaluation page's reliability diagram: points below the diagonal mean the agent is over-confident (raise thresholds or lower `selfAssessment` weight); points above mean it is under-confident and escalating unnecessarily.
