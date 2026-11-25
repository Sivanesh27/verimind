# Live demo script (≈ 10 minutes)

Prepare: two browser windows — **A** signed in as a normal user, **B** as an admin (email in `ADMIN_EMAILS`). Open **Monitor** in B.

## 1. High confidence → answer directly
A → Agent → chip **Factual** ("What is the capital of Australia?").
Show the live steps: analysis → draft + samples + Wikipedia retrieval → consistency & evidence judges → **Answered**, ~90%+. Open *Show reasoning*: positive factors "Supported by evidence", "Consistent reasoning", signal bars. B's Monitor feed updates live.

## 2. Tool verification
Chip **Tool check** ("48731 × 9257"). The calculator runs in parallel; "Verified by tool" appears and the tool signal is 100%.

## 3. Hallucination trap
Switch mode to **Compare both**, chip **Hallucination trap** ("Why did Einstein win his second Nobel Prize?").
- Baseline answers in one shot (and may invent a reason).
- Trust-aware: evidence contradicts the premise / model flags it → low confidence factors "Conflicting evidence" → corrects the premise or escalates.

## 4. Fabricated entity → escalation to human
Chip **Fabricated entity** (Kingdom of Marovia). Path shows `verify → escalate`; factors "No supporting source found", "Model unsure".
In B → **Review queue**: the escalation appeared instantly (and reviewers received an email). Edit the draft — "There is no historical Kingdom of Marovia…" — and **Send answer**. In A the answer appears live, tagged "Answered by human reviewer".

## 5. Ambiguity → clarifying question
Chip **Ambiguous** ("Is it safe to take it with alcohol?"). The agent asks which medication instead of guessing. Reply "ibuprofen" in the inline box → a follow-up run uses the original question + clarification and answers (high-stakes → stricter threshold, possibly verified or specialist).

## 6. Real-time / high-stakes
Chip **Real-time** (Bitcoin price): "Time-sensitive question" factor, declines to give a fabricated number.
Chip **High-stakes** (acetaminophen dose): "High-stakes (medical)" factor, stricter threshold → verify/specialist route.

## 7. Monitoring & audit trail
B → **Monitor**: route distribution, confidence histogram, latency, escalation rate, live feed. A → **History**: every decision with full reasoning, signals and sources (audit trail).

## 8. Evaluation
B → **Evaluation → Run evaluation** (or show a previous run). Walk through: accuracy, hallucination rate, failed decisions, unnecessary escalations, latency trade-off, ECE/Brier and the reliability diagram, then the per-scenario table.
