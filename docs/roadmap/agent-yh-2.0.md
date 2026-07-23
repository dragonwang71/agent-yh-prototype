# Agent yh 2.0 roadmap

## Completed in this iteration

- Thin API route and bounded single-agent orchestrator
- Responses API with strict Structured Outputs and deterministic fallback
- Clarification instead of fake product or place defaults
- Typed Yahoo tools with abort, timeout, retry, and schema validation
- Shopping and outing ranking with visible score contributions
- Field-level evidence and final grounding validation
- Delta streaming contract and structured trace
- Approval-only structured memory
- Local anonymous quality signals
- Minimal responsive UI and development trace debugger
- 120-case deterministic evaluation, model sample, live canary, and Playwright E2E
- Best-effort burst limiting and security documentation

## Next validation work

1. Run consented usability sessions and convert failure patterns into new eval cases.
2. Add replay from saved sanitized tool fixtures to the trace debugger.
3. Compare model profiles only after collecting a broader multilingual eval set.
4. Add a shared production rate-limit and daily spend guard before meaningful public traffic.

## Optional frontier experiments

- Local MCP package exposing the grounded Yahoo skills to other agents
- Proactive price or weather watches with explicit approval
- Programmatic tool calling for larger, bounded candidate sets

Each experiment must beat the current workflow on measured quality, latency, or maintainability before becoming a default.
