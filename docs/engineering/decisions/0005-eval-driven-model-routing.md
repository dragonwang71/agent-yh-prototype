# ADR 0005: Evaluation before model routing

## Decision

Keep `gpt-5.6-terra` as the configurable baseline and do not route tasks across models until the same category-stratified evaluation can compare them.

## Why

Model names and price tiers are not evidence that a route improves this product. Task-specific quality, latency, fallback, and token results are.

## Consequences

`eval:model` records actual model usage separately from deterministic recovery. A future routing change needs a measured comparison and a documented rollback condition.
