# ADR 0002: Responses API and strict Structured Outputs

## Decision

Use the official OpenAI JavaScript SDK, Responses API, and a Zod-backed root object for intent parsing. Set `store: false` and validate the parsed result again at runtime.

## Why

Plain JSON mode guaranteed JSON syntax but not the application schema. Strict outputs make clarification, unsupported requests, shopping, and outing explicit contract variants. The root wrapper is required because Structured Outputs does not accept a union as the root schema.

## Consequences

Model failures and timeouts remain normal runtime events and fall back to deterministic parsing. Model and prompt changes must run the model evaluation separately from the deterministic suite.
