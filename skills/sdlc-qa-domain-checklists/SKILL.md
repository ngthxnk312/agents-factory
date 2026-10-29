---
name: sdlc-qa-domain-checklists
description: Apply reusable domain risk checklists to QA work — payments and fintech, digital banking (retail and business), CRM, AI chatbots and LLM features, e-commerce, plus cross-cutting concerns (identity and sessions, roles, offline and sync, integrations, batch jobs, notifications, files, search, migrations) — to find risks the specification forgot, split test cases by the states that matter, judge coverage depth, and decide what is safe to automate. Use during QA requirement analysis, test design, suite review and automation selection whenever the feature belongs to one of these domains.
stage: 0-foundation
role: qa
icon: 🗂
mode: plan
prefer: qa-domain-checklists, domain-test-checklists, domain-risk-checklists
---

# QA domain checklists

Generic techniques find generic bugs. Domain checklists encode where real systems in a domain fail — money duplicated, approvals bypassed, records merged wrongly, a model inventing a policy — so that an agent tests what matters instead of what is easy. They complement, never override, the project's requirements.

## When to use

- `sdlc-qa-requirement-analysis`: find missing rules and risks; turn them into questions.
- `sdlc-qa-test-design`: choose state combinations, edge cases and depth.
- `sdlc-qa-testcase-review`: judge domain alignment (covered vs shallow vs missing).
- `sdlc-qa-automation`: decide what is stable and safe to automate in this domain.

## When not to use

- As a source of business rules. A checklist item becomes a test only when the requirements confirm the behavior; otherwise it becomes an **open question**. Never assert "the system must lock after 3 attempts" because a checklist mentions attempt limits.

## Available checklists (`reference/`)

| File | Covers |
|------|--------|
| `cross-cutting.md` | Identity, sessions, authorization, input handling, offline/sync, integrations, batch jobs, notifications, files, search/filter, data migration, audit — applies to every domain |
| `payments-fintech.md` | Money movement, wallets, cards, QR, bills, fees, FX, limits, step-up authentication, transaction lifecycle, idempotency, concurrency, reconciliation, compliance |
| `digital-banking.md` | Retail mobile banking (onboarding, devices, account states, statements) and business banking (maker-checker-approver, permission matrix, bulk files, approvals on mobile) |
| `crm.md` | Leads/contacts/accounts/opportunities, duplicates and merge, ownership and sharing, pipelines, activities, imports, mobile offline sync |
| `ai-chatbot-llm.md` | Intent handling, grounding and hallucination, multi-turn context, guardrails and prompt injection, escalation, privacy, evaluation methodology |
| `e-commerce.md` | Catalog, search, cart, pricing and promotions, checkout, payment, inventory, orders, returns/refunds, shipping, accounts |

## Procedure

1. **Classify the feature** into one or more domains and always add `cross-cutting.md`. A mobile payment feature uses payments-fintech + digital-banking (retail) + cross-cutting.
2. **Extract applicable items.** Read the matching sections; list items that plausibly apply to this feature. Skip what clearly does not (state why in one line, so reviewers see it was considered).
3. **Map each item** to: an existing requirement (→ test condition), a missing requirement (→ open question with impact), or not applicable.
4. **Split states, never "a valid user".** Use the state dimensions listed in each checklist (actor state, object state, limit state, dependency state, device state) to build the state-combination matrix in the test data specification.
5. **Set depth by consequence.** Items marked **[C]** (money, security, data integrity, legal) require happy + negative + boundary + failure/recovery coverage and verification of stored state; others at least one meaningful case.
6. **Apply the automation notes** in each checklist when selecting candidates — stable rule checks are good candidates; anything depending on real external effects, real devices, real one-time codes or human judgement is manual or partial.
7. **Record what was used**: list the checklists and sections applied in the requirement analysis or test design overview, so the review can check alignment.

## Adding a domain checklist

Create `reference/<domain>.md` with the same structure: scope; state dimensions; risk areas with **[C]** markers; lifecycle or flow stages to cover; typical edge cases; integration points and their failure modes; security/privacy/compliance items; common defects seen in the domain; signs of a weak test suite; automation notes. Keep it product-neutral: no company, customer or product names, no real thresholds presented as universal (write "the configured limit", not a number). Product-specific values belong in the project's own skill, which takes precedence over this one.

## Guardrails

- Checklist items never become expected results without a requirement source.
- Use synthetic data and test environments for every domain; nothing in these checklists justifies touching production or real customer data.
- Regulatory items (anti-money-laundering, consumer protection, data protection, accessibility law) are flagged for the compliance owner; QA verifies what the requirements specify and asks about the rest.

## Output (to embed in the calling skill's artifact)

```markdown
### Domain checklists applied
| Checklist / section | Item | Mapped to (REQ / BR / question / N/A) | Depth | Automation note |
```

## Hand-off

The mapped items flow into the questions list (`sdlc-qa-requirement-analysis`), the state matrix and edge cases (`sdlc-qa-test-design`), the domain-alignment section (`sdlc-qa-testcase-review`) and the candidate decisions (`sdlc-qa-automation`).
