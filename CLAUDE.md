# elaws-viewer — 法令ビューア & アノテーションデータ仕様

e-Gov 法令API から日本の法令本文を取得し、ハイライト/下線/タグ/ブックマーク/メモを
Realm DB で管理する個人用 Web アプリ。本ドキュメントは内部仕様書として、
Realm スキーマ・anchor 記法・style 番号と色の対応表を定義する。

## データファイル

- 形式: **Realm (TightDB) データベース v23**
  - マジック: オフセット `0x10` に `T-DB`
  - フォーマット version: 0x18 (=24)
  - スキーマ version: 23
- 外部エクスポートファイルは独自拡張子で出力されるが、中身は通常の Realm ファイル
  （`.realm` リネームすればそのまま読める）
- 既存サードパーティ製品との相互運用を想定して同一スキーマを採用

## スキーマ（Realm クラス）

### `SelectionObject` (pk=`uuid`) — ハイライト/下線本体
| field | type | notes |
|---|---|---|
| `uuid` | string | UUID を URL-safe Base64 化（22文字） |
| `lawNo` | string indexed | 例: `明治二十九年法律第八十九号` |
| `style` | int | **色＋種別を表す唯一のフィールド**。下記参照 |
| `row` | int | テキスト行番号 |
| `startIndexInRow` | int | 行内開始オフセット |
| `startAnchor` | string indexed | 例: `条400/項1/文1`, `条555/頭`, `前0/項1/文` |
| `endAnchor` | string indexed | 範囲終端アンカー |
| `startString` | string | 開始テキスト |
| `startStringOccurrenceIndex` | int | 同一文字列の何回目か |
| `endString` | string? | 終端テキスト |
| `attributedString` | data? | リッチテキスト（実際にはほぼ使われない） |
| `embeddedObject` | data? | 手描き図形（HEIC）。`style=13` の時のみ |
| `embeddedObjectTextRep` | string? | 手描きの説明文 |
| `notes` | string? | メモ |
| `isDeleted` | bool | 論理削除フラグ |
| `createdAt`, `updatedAt` | date | |

### `Bookmark` (pk=`uuid`) — ブックマーク
`lawNo`, `filepath`, `anchor`, `row`, `title`, `notes`, `attributedString`, `order`, `isDeleted`, `createdAt`, `updatedAt`

### `DownloadedLaw` (pk=`uuid`) — ダウンロード済法令
`lawNum` (例 `平成十七年法律第八十六号`), `lawTitle` (例 `会社法`),
`lawEdition`, `filename` (例 `417AC0000000086_20260501_506AC0000000032` ＝ e-Gov の law_id),
`mishikoLawNum`, `addedDate`, `filepath`, `order`, `title`, `isDeleted`

### `Organizable` (pk=`uuid`) — 法令の並べ替え用
`filepath`, `order`, `title`, `isDeleted`

### `Tag` (pk=`uuid`) — タグ適用（位置×タグ）
`lawNo`, `anchor`, `tagNumber`, `isDeleted`

### `TagEntity` (pk=`tagNumber`) — タグ定義（8つ固定）
`tagNumber` (0..7), `order`, `title`, `colorType` (0..7), `isDeleted`

### `PendingSyncTask` (pk=`id`) — 外部同期キュー
`recordName`, `zoneName`, `ownerName`, `objectType`, `objectPrimaryKey`,
`deleteOperation`, `dedupeKey`, `retryCount`, `lastErrorCodeRaw`,
`lastErrorDescription`, `nextAttemptAt`, `disabled`, `note`,
`createdAt`, `updatedAt`

## **`style` → 色マッピング**

色番号は連番ではなくアプリのバージョン追加順に飛び飛び。
実機での虹色サンプル取得 + Pillow ピクセル走査で確定済み。

| style | 種別 | 色 | hex (近似) |
|---:|---|---|---|
| 0 | マーカー | 黄 | `#f5ea84` |
| 1 | マーカー | 緑 | `#cded83` |
| 2 | マーカー | 青 | `#b5d3eb` |
| 3 | マーカー | 赤 | `#eaadbc` |
| 4 | マーカー | 紫 | `#cdb0e9` |
| 11 | マーカー | オレンジ | `#efc07b` |
| 104 | マーカー | グレー（暗記隠し用、後付け追加） | `#b4b2af` |
| 5 | 下線 | 赤 | `#c34235` |
| 6 | 下線 | 青 | `#2036b9` |
| 7 | 下線 | 緑 | `#71954e` |
| 8 | 下線 | 黄 | `#e1cd6e` |
| 9 | 下線 | 紫 | `#c761d1` |
| 10 | 下線 | オレンジ | `#d79553` |
| 12 | 下線 | グレー | `#e6e6db` |
| 13 | 特殊 | 手描き図形 (HEIC, `embeddedObject`) | — |

### 設計上の特徴
- マーカーはパステル、下線は原色／鮮やか
- グレーマーカー (style=104) は**暗記用の隠しオーバーレイ**で、
  通常マーカーとは別機能扱い。番号が3桁飛んでいるのもそのため
- スロット 11 はオレンジ・マーカーに使われたため、下線オレンジは 10、
  下線紫は 9、下線グレーは 12 と歯抜けになっている

## アンカー記法

`startAnchor` / `endAnchor` は法令内位置の文字列キー。

- `条N/頭` — 第N条の冒頭（条文番号自体）
- `条N/項M/文K` — 第N条第M項第K文
- `条N_M` — 第N条のM（枝条）
- `前0/項M/文K` — 前文（憲法など）

例:
- `条400/項1/文1` — 民法400条1項1文（善管注意義務）
- `条576/頭` — 会社法576条の見出し
- `前0/項1/文` — 憲法前文1項

## 実装スコープ

iOS 参考実装との相互運用のためスキーマ v23 は完全に定義しているが、本 web 実装では
以下を**意図的に実装しない**（決定済み・着手予定なし）。

- **`PendingSyncTask`** — iCloud 同期キュー。本プロジェクトでは SSE で
  クロスデバイス同期を実装済（`/api/events`）。スキーマ定義のみ保持して
  Read/Write しない。下手に触ると iOS 側との同期が壊れる。
- **`SelectionObject.attributedString` / `embeddedObject` / `embeddedObjectTextRep`** —
  作成時 null 固定。リッチテキストと手描き図形 (HEIC) は表示しない。
  style=13 は overlay 上にプレースホルダ (`sel-drawing-13` クラス) のみ。
- **`Bookmark.attributedString`** — 同上、null 固定。
- **Bookmark 作成 UI** — read/delete のみ。`createBookmark` API は実装済だが
  web UI からは呼ばれない（iOS 側で作成された既存 Bookmark の閲覧用）。
- **Tag 付与 UI** — `TagEntity` の名前変更のみ。anchor に tag を付ける操作は
  サーバー API (`/api/tags/applications`) は揃っているが web UI には無い。
- **`SelectionObject.notes` / `Bookmark.notes` 編集 UI** — サーバー API は対応
  済みだが、web に編集画面は提供しない。

「実装してあるべきだが未着手」ではなく**仕様として割り切った機能群**。アンカー取得
(`web/src/components/LawViewer/useSelectionCapture.ts`) や Tag 付与 API は揃っている
ので、将来必要になった時の参入コストは低い。

## 法令ファイル名 (`DownloadedLaw.filename`)

e-Gov 法令API の `<law_id>_<施行日>_<改正法ID>` 形式。
例: `129AC0000000089_20260401_506AC0000000033`
- `129AC0000000089` = 民法 (明治29年法律第89号)
- `20260401` = 2026年4月1日施行版

## デバッグ用スクリプト

`realm-reader/` 配下に Node.js + realm SDK で `.realm` ファイルを開く
調査スクリプト群（gitignore外、`storage/annotations.realm` をローカルで
解析するため温存。コミットされている）。

- `realm-reader/probe.js` — スキーマ全出力
- `realm-reader/dump.js` — 全クラスのカウントと各 lawNo の style 分布
- `realm-reader/styles.js` — 全 style の出現数、blob 存在チェック
- `realm-reader/identify.js` — 未確定 style の識別用サンプル一覧
- `realm-reader/diff.js` — 旧 `work.realm` vs 新 `work2.realm` の差分

開く時は **必ず `.realm` 拡張子の writable copy を作って読み込む**
（Realm SDK の要件）。

### 起動
```bash
cd realm-reader && node probe.js
```

## 注意点

- `attributedString` は実データではほぼ全件 null。色の復元は `style` 一本で行う。
- `PendingSyncTask` を編集すると外部同期で意図しない上書きが起きうるので慎重に。
- `row` の採番規則は外部アプリと完全一致を保証しにくいため、復元時は
  `startAnchor + startString + startStringOccurrenceIndex` を優先的に使う。
