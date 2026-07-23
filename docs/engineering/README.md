# Engineering guide

Agent yh の実装判断と運用方法を、コードから独立して確認できるようにまとめています。

| 文書 | 内容 |
| --- | --- |
| [../architecture-v2.md](../architecture-v2.md) | v2 の境界、データフロー、責務分離 |
| [../evaluation.md](../evaluation.md) | deterministic / model / live の評価基盤 |
| [../benchmark.md](../benchmark.md) | 実測値と評価上の限界 |
| [feedback-loop.md](feedback-loop.md) | 利用者フィードバックから改善までのループ |
| [quality-gates.md](quality-gates.md) | ローカルと CI の完了条件 |
| [operations.md](operations.md) | 障害時の切り分け、秘密情報、リリース運用 |
| [decisions/0001-source-grounded-agent.md](decisions/0001-source-grounded-agent.md) | 外部データを回答の根拠にする設計判断 |
| [decisions/0002-responses-structured-outputs.md](decisions/0002-responses-structured-outputs.md) | Responses と strict schema |
| [decisions/0003-bounded-single-agent.md](decisions/0003-bounded-single-agent.md) | bounded single-agent |
| [decisions/0004-structured-local-memory.md](decisions/0004-structured-local-memory.md) | 承認制の構造化メモリー |
| [decisions/0005-eval-driven-model-routing.md](decisions/0005-eval-driven-model-routing.md) | 評価後に model routing |
| [decisions/0006-tracing-and-redaction.md](decisions/0006-tracing-and-redaction.md) | trace と redaction |

実装変更時は、最も近い文書と `harness/` のケースを一緒に更新します。
