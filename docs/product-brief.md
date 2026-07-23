# Product brief

## Product

Agent yh is an evaluation-driven, source-grounded decision agent for shopping and local outings in Japan. It turns an everyday request into verifiable constraints, retrieves current Yahoo! JAPAN data, ranks candidates deterministically, and keeps uncertainty visible.

## User problem

Search results are plentiful, but the user still has to translate a vague goal into queries, compare inconsistent fields, check constraints, and decide what to do next. Agent yh shortens that path while keeping the source page one click away.

## Product principles

1. Ask one useful question when a critical product or place is missing.
2. Use the model for language and ambiguity; use code for facts, budgets, ranking, permissions, and failure boundaries.
3. Show only facts linked to returned source fields.
4. Label heuristics and unknown fields instead of filling gaps.
5. Save a preference only after explicit approval.
6. Keep the main experience quiet; place engineering evidence in expandable and development-only surfaces.

## Current scope

- Shopping decisions for supported home-appliance requests
- Local outing decisions using geocoding, weather, and nearby-place data
- Japanese-first UI with English and Chinese support
- Local-first conversations, approved memory, feedback, and anonymous quality events

## Out of scope

- Purchases, bookings, emails, or other side effects
- Authentication, shared accounts, or server-side conversation storage
- Generic web research or document RAG
- Autonomous multi-agent execution
