# ADR 0006: Observable decisions without hidden reasoning

## Decision

Trace state changes, sanitized tool summaries, scores, evidence, usage, latency, and error codes. Do not expose hidden chain-of-thought, credentials, or raw upstream payloads.

## Why

The project needs reproducible failure evidence without turning debugging data into a privacy or prompt-injection channel.

## Consequences

Detailed traces are development-only. The public UI shows concise execution status, while raw prompts and API responses stay out of anonymous product events.
