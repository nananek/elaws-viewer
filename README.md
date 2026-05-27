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

ローカルでビルド:

```bash
docker compose -f docker/docker-compose.yml up -d --build
tailscale serve --bg --https=443 http://localhost:3000
```

GHCR の事前ビルド済みイメージを使う場合 (`main` 追従 / マルチアーキ amd64+arm64):

```bash
docker pull ghcr.io/nananek/elaws-viewer:main
docker run -d --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v "$PWD/storage:/app/storage" \
  ghcr.io/nananek/elaws-viewer:main
```

初回のみ、GitHub Web UI で Packages → `elaws-viewer` → Settings から
公開可視性を `Public` に切り替えるか、Personal Access Token で `docker login ghcr.io`。

## キーボードショートカット

| キー | 動作 |
|---|---|
| `?` | ヘルプ表示 / 非表示 |
| `/` | 法令ビューアで条番号入力にフォーカス |
| `g 数字 Enter` | 第N条にジャンプ (例 `g 400 Enter`) |
| `g 数字 の 数字 Enter` | 枝条にジャンプ (例 `g 2 の 7 Enter` → 第2条の7) |
| `Esc` | 入力解除 / ジャンプバッファ取消 |

## バックアップ

サーバー起動中、毎日 03:00 JST に
`storage/backups/annotations-YYYYMMDD.realm` を `writeCopyTo` で生成し、
直近 14 日分を保持。手動実行は `curl -X POST http://localhost:3000/api/backup`。

## ライセンス

MIT
