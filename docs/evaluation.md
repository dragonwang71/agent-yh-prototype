# Evaluation

Agent yh separates deterministic regression checks, model checks, and live upstream canaries.

## 1. Deterministic PR evaluation

```bash
npm run eval:deterministic
```

- 120 synthetic, non-personal cases
- Fixed Yahoo fixtures
- Runs without model or external API calls
- Covers routing, slots, clarification, languages, adversarial text, memory conflicts, hard budgets, ranking, and evidence rejection
- Writes `evals/reports/deterministic.json` and `.md`
- Runs in CI and fails below the declared gates

Dataset distribution:

| Category | Cases |
|---|---:|
| Shopping | 30 |
| Outing | 30 |
| Multilingual variants | 20 |
| Clarification | 15 |
| Upstream failure context | 10 |
| Adversarial text | 10 |
| Memory conflicts | 5 |

## 2. Model evaluation

```bash
npm run eval:model -- --limit=20
```

This manually runs a category-stratified sample through the configured OpenAI model. The report records task outcome, whether the model was actually used, fallback recovery, token usage, latency, and failure reason. A correct deterministic fallback is reported separately from model-only accuracy.

## 3. Live canary

```bash
npm run eval:live
```

This checks a small Yahoo Shopping and Geocoder request without storing response payloads. It reports status, latency, evidence count, and typed error code. It is manual because upstream availability and credentials should not gate every pull request.

## Regression gates

| Metric | Gate |
|---|---:|
| Deterministic cases | 120 |
| Intent accuracy | ≥ 97% |
| Slot exact match | ≥ 95% |
| Clarification precision | ≥ 95% |
| Valid-fixture grounding precision | 100% |
| Unsupported factual claim rate | 0% |
| Evidence guard catch rate | 100% |
| Hard-budget satisfaction | 100% |

These gates describe the fixed dataset only. They are not claims about every possible user request or Yahoo result.
