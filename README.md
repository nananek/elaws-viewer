# elaws-viewer

e-Gov 法令API v2 から日本の法令本文を取得し、ハイライト・下線・タグ・ブックマーク・メモを
**Realm DB** で管理する個人用の Web 法令ビューア。Tailscale 内 LAN で常時稼働させ、
PC・iPhone・iPad のブラウザから日常学習に使うことを想定。

## 主な機能（MVP）

- e-Gov 法令API v2 から法令を取得して構造化表示
- 条文番号ジャンプ（"123" / "第百二十三条" / "2の7" を受け付け）
- 7色マーカー + 7色下線 + 暗記隠しグレーマーカー
- ブックマーク（フォルダ整理）、タグ
- 法令内検索・横断全文検索（SQLite FTS5）
- タブで複数法令を同時に開く
- オフライン PWA（ホーム画面追加可）
- Realm DB のインポート/エクスポート

## 動作環境

- Node.js 22 LTS（`realm@20.x` のため）
- Docker（本番デプロイ）
- ストレージ: 数十 MB 程度（法令 XML キャッシュ）

## 技術スタック

| レイヤ | 採用 |
|---|---|
| サーバー | Hono (Node adapter) |
| フロント | Vite + React 19 + TypeScript |
| ルーティング | TanStack Router |
| 状態管理 | TanStack Query + Zustand |
| UI | Tailwind v4 + shadcn/ui |
| 永続化 | Realm + SQLite (better-sqlite3, FTS5 trigram) |
| XML | fast-xml-parser |
| デプロイ | Docker + docker compose |

## 開発

```bash
# 依存
pnpm install

# 開発サーバー（web=5173, server=3000 並走）
pnpm dev

# テスト
pnpm test
```

## デプロイ

```bash
docker compose -f docker/docker-compose.yml up -d --build
tailscale serve --bg --https=443 http://localhost:3000
```

## ライセンス

MIT
