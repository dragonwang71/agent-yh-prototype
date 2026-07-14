# Operations

## 設定

- `YAHOO_CLIENT_ID`: Shopping / Geocoder / Weather / Local Search
- `OPENAI_API_KEY`: intent、次ツール選択、memory 更新
- `OPENAI_MODEL`: model override。未指定時は品質と応答速度のバランスを取る既定値を使う

秘密情報は `.env.local` と Vercel の環境変数で管理し、ログ、fixture、README、commit に含めません。

## 障害の切り分け

1. 画面の実行ログで失敗した段階を確認する。
2. OpenAI の失敗で fallback が動いたか確認する。
3. Yahoo API の status、利用上限、認証設定を確認する。
4. timeout の場合は、外部状態を確認してから再実行する。
5. UI に古い結果が混ざる場合は request cancellation と conversation id を確認する。

## リリース

1. `npm run check`
2. デスクトップとモバイルの smoke test
3. GitHub CI の成功
4. Vercel production deploy
5. production URL で shopping / outing を各一回確認

問題が見つかった場合は、直前の Vercel deployment へ戻し、再現ケースを harness へ追加してから修正します。
