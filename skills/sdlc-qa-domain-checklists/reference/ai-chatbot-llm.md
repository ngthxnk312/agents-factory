# AI chatbot and LLM feature checklist

Scope: conversational assistants, retrieval-augmented answers over documents, tool-using agents, LLM-generated summaries/classifications inside products, intent-based bots. Use with `cross-cutting.md`.

LLM outputs are non-deterministic: test with **evaluation sets and rubrics**, not single exact-match assertions, and record model/version, prompt/version, temperature and retrieval index version for every evaluation run.

## State dimensions

User role and entitlement; conversation state (new, mid-flow, after handoff, resumed after timeout); language and locale; channel (web widget, mobile, messaging app, voice); knowledge source state (fresh, stale, missing document, conflicting documents); tool/dependency state (available, slow, error).

## Checklist

### Understanding and intent

- Each supported intent with paraphrases, typos, mixed language, slang, very short and very long inputs
- Out-of-scope requests → defined fallback, not a fabricated answer
- Ambiguous requests → clarifying question as specified
- Empty input, whitespace, emoji-only, maximum length (max, max+1), pasted code/markup

### Grounding and accuracy

- [C] Answers on facts, prices, policies, eligibility, balances are grounded in the approved source or a tool result; citations/links point to the actual source
- [C] No invented policy, number, date, product or person; "I don't know" / handoff when sources lack the answer
- Conflicting or outdated source documents handled per requirement
- Calculations done by tools, not by the model, where correctness matters

### Multi-turn context

- References to earlier turns ("that one", "the second option") resolved correctly
- Context window limits: long conversations keep the essentials; summary/truncation does not drop constraints
- Topic switch and return; restart conversation clears context as specified
- [C] No context leakage between users or sessions

### Safety and guardrails

- [C] Prompt injection: direct ("ignore your instructions"), indirect via retrieved documents, web pages, files or tool outputs; the bot does not reveal system prompts, secrets or other users' data
- [C] Jailbreak attempts for disallowed content categories defined by the product policy
- [C] Tool use: actions with side effects require confirmation; the model cannot call tools beyond the user's permissions; arguments validated server-side
- Harmful, abusive, self-harm, medical/legal/financial advice boundaries as specified; escalation paths
- Tone and persona consistent; no discriminatory output across demographic variations of the same request (paired prompts)

### Privacy and data

- [C] Personal data in prompts not logged in plain text beyond policy; masking in transcripts; retention as specified
- [C] Answers never include another user's personal data; retrieval respects document-level permissions
- Opt-out of training/data use honored if offered

### Escalation and handoff

- Trigger conditions (user request, repeated failure, sensitive topic, low confidence) → handoff to human with transcript and context
- Out-of-hours behavior; queue position; returning from human to bot

### Performance and resilience

- Time to first token and full response under typical and peak load; streaming interruptions
- Model/provider timeout, rate limit, content-filter refusal, tool error → graceful message and retry policy
- Cost guardrails (max tokens, max tool calls per turn)

### Evaluation methodology

- Golden set per intent with expected facts and must-not-say items; adversarial set; regression set from production failures (anonymized)
- Rubric scoring (correctness, groundedness, completeness, safety, tone) by humans or an evaluator model calibrated against human labels
- Thresholds per category agreed with the owner; compare against the previous model/prompt version before release
- Run each case several times to measure variance; report pass rate with confidence, not a single run

## Common defects

Confident fabricated answers; citing a document that does not contain the claim; context bleed between sessions; injection via uploaded documents; tool called with another user's identifiers; fallback loop without handoff; locale switching mid-answer.

## Signs of a weak suite

Only happy-path questions; exact-string assertions on generated text; no adversarial or injection set; no versioning of prompt/model in results; single run per case.

## Automation notes

Candidates: evaluation harness with golden/adversarial sets, schema checks on structured outputs, tool-permission checks via API, latency measurements. Manual: tone and helpfulness judgement samples, sensitive-topic review, red-teaming sessions. Never use real customer conversations without anonymization and approval.
