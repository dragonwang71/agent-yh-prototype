# ADR 0004: Structured, approval-only local memory

## Decision

Store typed memory items in the browser only after explicit user approval. Keep source run, namespace, confidence, sensitivity, timestamps, and status.

## Why

A free-form automatically rewritten memory blob obscures provenance, conflicts, and the reason a preference affected a recommendation.

## Consequences

The UI includes approve, reject, edit, delete, clear, and export controls. There is no cross-device synchronization or server persistence.
