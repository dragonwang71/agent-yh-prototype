# ADR 0003: Bounded single-agent workflow

## Decision

Use one stateful orchestrator with typed shopping and outing capabilities. Limit model calls, tool calls, retries, and wall-clock time.

## Why

The two tasks are short, ordered workflows. Multiple agents would add handoffs, cost, and debugging surfaces without an independent subproblem that benefits from delegation.

## Consequences

New capabilities join through typed modules and state transitions. Multi-agent orchestration remains out of scope until evaluation demonstrates a concrete need.
