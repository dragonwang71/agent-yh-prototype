# Quality gates

## ローカル

```bash
npm run check
```

このコマンドは次を順に実行します。

1. TypeScript の strict typecheck
2. agent harness と contract tests
3. Next.js production build

## CI

GitHub Actions は main への push と pull request で同じ検査を行います。新しい commit が入ると古い実行を中止し、10分で timeout します。

## UI 変更

- 1440 × 900: 左ナビ、回答、実行ログの三領域
- 390 × 844: 上部ナビ、回答、composer の reflow
- starter → prompt 入力 → 実行中 → 回答 → 外部リンク → feedback
- キーボード focus、accessible name、disabled state

## 完了の定義

検査結果、未確認項目、残るリスクを PR に残します。外部 API の成功は build だけでは保証できないため、リリース前に実データ smoke test を一回行います。
