# Measured quality snapshot

Measured on 2026-07-23. Raw reports are under `evals/reports/`.

## Deterministic fixtures

| Metric | Result |
|---|---:|
| Cases | 120 |
| Intent accuracy | 100% |
| Slot exact match | 100% |
| Clarification precision | 100% |
| Grounding precision on valid fixtures | 100% |
| Unsupported factual claim rate | 0% |
| Evidence guard catch rate | 100% |
| Hard-budget satisfaction | 100% |
| Deduplication / review-confidence / distance gates | Pass |

The original harness contained five representative routing cases. The v2 suite expands coverage to 120 cases and adds ranking, evidence, clarification, adversarial, and memory-conflict checks. Results are not treated as a like-for-like historical model benchmark.

## Model evaluation

Configured model: `gpt-5.6-terra`

| Metric | Result |
|---|---:|
| Category-stratified cases | 20 |
| Model usage | 20 / 20 |
| Model-backed hybrid outcome | 100% |
| Deterministic field normalization/correction | 6 / 20 |
| End-to-end task outcome | 100% |
| Fallback recoveries | 0 |

The sample is synthetic and intentionally small; it verifies the contract and prompt, not broad real-world generalization.

## Live Yahoo canary

| Tool | Status | Latency | Evidence references |
|---|---:|---:|---:|
| Shopping search | Pass | 452 ms | 140 |
| Geocoder | Pass | 231 ms | 2 |

Live latency varies with network and upstream state. The canary reports observed values rather than setting a CI performance gate.
