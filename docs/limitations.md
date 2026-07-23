# Limitations

- The deterministic fallback recognizes a deliberately small set of product categories and Japanese locations.
- Relative dates such as “Saturday” are marked unverified when the returned weather window cannot be mapped safely.
- Rain suitability is a category-level heuristic; opening hours and exact indoor conditions may be absent.
- Ranking quality depends on the fields returned by Yahoo! JAPAN. Missing dimensions, hours, or review data remain unknown.
- The agent has no purchase, booking, notification, or messaging side effects.
- Memory and analytics are local to one browser and are not synchronized.
- The API has a best-effort per-instance burst limit. A production multi-instance deployment needs a shared rate-limit and budget service.
- Estimated model cost is not shown until a maintained pricing configuration is added.
- The development trace page supports sanitized inspection. Full offline trace replay and automatic model-profile comparison remain future work.
- Fixed and model evaluation sets are synthetic; user research and larger production-like samples are still needed.
