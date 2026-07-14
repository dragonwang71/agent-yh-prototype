# Engineering guide

Agent yh の実装判断と運用方法を、コードから独立して確認できるようにまとめています。

| 文書 | 内容 |
| --- | --- |
| [architecture.md](architecture.md) | 境界、データフロー、責務分離 |
| [ai-harness.md](ai-harness.md) | モデル変更を安全にする評価基盤 |
| [feedback-loop.md](feedback-loop.md) | 利用者フィードバックから改善までのループ |
| [quality-gates.md](quality-gates.md) | ローカルと CI の完了条件 |
| [operations.md](operations.md) | 障害時の切り分け、秘密情報、リリース運用 |
| [decisions/0001-source-grounded-agent.md](decisions/0001-source-grounded-agent.md) | 外部データを回答の根拠にする設計判断 |

実装変更時は、最も近い文書と `harness/` のケースを一緒に更新します。
