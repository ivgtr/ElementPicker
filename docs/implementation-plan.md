# Element Picker Implementation Plan

## 目的

初期リリースでは、拡張機能アイコンからページ上の要素選択モードを開始し、選択した要素以下の内容を HTML、Markdown、プレーンテキストのいずれかでクリップボードにコピーできるようにする。

この計画書は `docs/requirements.md` の初期リリース範囲を実装単位へ落とし込むための技術設計である。

## 初期実装スコープ

実装する機能:

- 拡張機能アイコンのクリックで要素選択モードを開始する。
- ホバー中の HTML 要素を視覚的に強調表示する。
- クリックでコピー対象要素を確定する。
- 選択モード中はページ本来のリンク、ボタン、クリックハンドラを実行させない。
- HTML、Markdown、プレーンテキストからコピー形式を選択できる。
- 選択した要素とその子孫に範囲を限定してコピーする。
- コピー成功、失敗、キャンセルをユーザーへ通知する。
- `Esc` キーまたは UI 操作でキャンセルできる。
- 終了時に追加した DOM、スタイル、イベントリスナーをすべて削除する。

初期実装では扱わない機能:

- 画像コピー
- JSON コピー
- CSS Selector コピー
- XPath コピー
- 複数要素選択
- ページをまたいだ収集
- コピー履歴
- クラウド同期
- iframe 内選択
- Shadow DOM 内選択
- コピー前プレビュー

## 現在の技術前提

- Manifest V3
- Vite
- `@crxjs/vite-plugin`
- TypeScript
- `turndown` による Markdown 変換
- React、popup、options、offscreen page は初期実装では使わない。

既存エントリポイント:

- `src/background/index.ts`
- `src/content/content-script.ts`
- `src/shared/messages.ts`
- `manifest.config.ts`

## アーキテクチャ

### 全体構成

```text
Browser action click
  -> background service worker
  -> activate manifest-declared content script
  -> page selection mode
  -> format selection UI
  -> clipboard write
  -> cleanup and notify
```

### Background

責務:

- 拡張機能アイコンのクリックを受け取る。
- 現在のタブの content script に選択モード開始メッセージを送る。
- content script が動作していないページでは警告に留める。

設計方針:

- background は選択状態を持たない。
- ページ DOM に依存する処理は content script に閉じ込める。
- content script は `manifest.config.ts` の `content_scripts` で宣言し、CRXJS に処理させる。
- タブ URL が Chrome 内部ページなど content script 対象外の場合は何もしないか、ログに留める。

### Content Script

責務:

- 選択モードの状態管理
- hover 対象要素の追跡
- 強調表示オーバーレイの描画
- クリック確定とページ本来のイベント抑止
- 形式選択 UI の表示
- コピー文字列の生成
- クリップボード書き込み
- 通知表示
- cleanup

想定する状態:

```ts
type PickerState =
  | 'idle'
  | 'selecting'
  | 'format-selecting'
  | 'copying';
```

初期実装では、content script 内の単一コントローラーで状態を管理する。状態が `idle` 以外のときに再度開始要求を受けた場合は、既存状態を cleanup してから新しく開始する。

### Shared Messages

`src/shared/messages.ts` に、background と content script の通信に使う型を置く。

想定する型:

```ts
export const START_ELEMENT_PICKER = 'element-picker:start';

export type CopyFormat = 'html' | 'markdown' | 'text';

export type ElementPickerMessage = {
  type: typeof START_ELEMENT_PICKER;
};
```

初期実装では結果通知を background に戻す必要はない。通知は content script がページ上に表示する。

## UI 設計

### Hover Overlay

要素選択中は、現在ホバーしている要素の `getBoundingClientRect()` を使って固定配置のオーバーレイを表示する。

方針:

- ページ内容を大きく邪魔しない枠線表示にする。
- `pointer-events: none` を指定し、オーバーレイが選択操作を妨げないようにする。
- スクロールや resize 時にも位置を更新する。
- `html`、`body`、拡張機能が追加した UI は選択対象から除外または慎重に扱う。

### Format Menu

要素クリック後、クリック位置または対象要素の近くに小さな固定配置 UI を表示する。

含める操作:

- `HTML`
- `Markdown`
- `Text`
- `Cancel`

方針:

- UI には識別用 data 属性を付け、選択対象から除外する。
- ビューポート外にはみ出さないように位置を補正する。
- UI 内のクリックはページ側へ伝播させない。

### Notification

コピー成功、失敗、キャンセルは一時的なトーストで表示する。

方針:

- 固定配置で短時間表示する。
- 同時に複数表示しない。
- 表示後は自動削除する。
- cleanup 時にも必ず削除する。

## イベント設計

選択モード中に登録するイベント:

- `pointermove`: hover 対象の更新
- `click`: 対象確定、ページイベント抑止
- `keydown`: `Esc` キャンセル
- `scroll`: overlay 位置更新
- `resize`: overlay 位置更新

イベント抑止:

- 選択モード中の `click` は capture phase で受ける。
- 対象確定時は `preventDefault()` と `stopPropagation()` を実行する。
- 必要に応じて `mousedown` / `mouseup` も capture phase で抑止する。

cleanup:

- 登録したイベントリスナーをすべて解除する。
- 追加した DOM ノードを削除する。
- 現在選択中の要素参照を破棄する。
- 状態を `idle` に戻す。

## コピー変換設計

### HTML

初期実装では `selectedElement.outerHTML` をコピーする。

方針:

- 選択要素そのものを含める。
- ページ全体ではなく、選択要素以下に限定する。
- 拡張機能が追加した UI はコピー対象に入れない。

### Markdown

`turndown` を使って HTML から Markdown に変換する。

方針:

- 入力は `selectedElement.outerHTML` を基本にする。
- 見出し、段落、リスト、リンク、画像、表を自然な Markdown に寄せる。
- 視覚的な装飾やレイアウト再現より、再利用しやすい本文構造を優先する。
- 必要になった時点で Turndown の rule を追加する。

### Plain Text

初期実装では `selectedElement.innerText` をコピーする。

方針:

- ユーザーが画面上で読める内容に近いテキストを優先する。
- 前後の不要な空白は `trim()` する。
- 空文字の場合は失敗として通知する。

## エラー処理

想定する失敗:

- content script が動作しないページ
- クリップボード書き込み失敗
- 選択要素が存在しない
- 変換結果が空

対応方針:

- ページ上で発生した失敗は content script のトーストで通知する。
- content script 対象外ページなど content script が動作しないケースは、初期実装では background の console warning に留める。
- ユーザーが選択範囲を確認してからコピーする設計を維持し、意図しない秘匿情報のコピーを防ぐ補助にする。

## ファイル構成案

初期実装では既存ディレクトリ内に閉じる。

```text
src/
  background/
    index.ts
  content/
    content-script.ts
    picker-controller.ts
    copy.ts
    ui.ts
  shared/
    messages.ts
```

各ファイルの責務:

- `background/index.ts`: アイコンクリック、開始メッセージ送信
- `content/content-script.ts`: メッセージ受信、controller 起動
- `content/picker-controller.ts`: 選択状態、イベント、cleanup
- `content/copy.ts`: HTML、Markdown、Text の変換と clipboard write
- `content/ui.ts`: overlay、format menu、toast
- `shared/messages.ts`: メッセージ型、コピー形式型

## 実装順序

1. `shared/messages.ts` にメッセージ型とコピー形式型を定義する。
2. manifest で content script を宣言し、background から開始メッセージを送れるようにする。
3. content script で開始メッセージを受け取り、選択モードに入れるようにする。
4. hover overlay を実装する。
5. click 確定とページイベント抑止を実装する。
6. HTML コピーを実装し、最小の縦動線を通す。
7. format menu を実装し、HTML / Markdown / Text を選択できるようにする。
8. Markdown と Text のコピー処理を実装する。
9. toast 通知とキャンセル処理を実装する。
10. cleanup の漏れを確認し、スクロール、resize、再起動時の挙動を整える。
11. lint、type-check、build を通す。
12. 手動検証手順を README または DEVELOPMENT に追記するか判断する。

## 検証計画

自動検証:

- `npm run type-check`
- `npm run lint`
- `npm run build`

手動検証:

- 拡張機能を Chrome に読み込み、通常ページでアイコンから選択モードに入れること。
- hover した要素に枠が追従すること。
- リンクやボタンをクリックしてもページ遷移やページ側操作が発火しないこと。
- HTML コピーで対象要素の `outerHTML` がコピーされること。
- Markdown コピーで文書構造が概ね再利用しやすい形になること。
- Text コピーで画面上の可読テキストに近い内容がコピーされること。
- `Esc` と Cancel で終了できること。
- コピー成功、失敗、キャンセルが通知されること。
- 終了後に overlay、menu、toast、イベント抑止が残らないこと。
- 再度アイコンをクリックしても正常に開始できること。

## リスクと注意点

- `navigator.clipboard.writeText` はページやブラウザの制約で失敗する可能性がある。
- content script が動作できない Chrome 内部ページでは使用できない。
- ページ側の高い `z-index` UI と overlay/menu が競合する可能性がある。
- 大きな DOM を Markdown 変換すると重くなる可能性がある。
- `innerText` は表示状態に近い一方、ページ CSS の影響を受ける。
- iframe と Shadow DOM は初期対象外なので、対応しないことを明確に保つ。

## 完了条件

- 初期リリース範囲のユーザーフローが Chrome 上で一通り動作する。
- 選択、形式選択、コピー、通知、キャンセル、cleanup が確認できる。
- 初期対象外機能を実装していない。
- `npm run type-check`、`npm run lint`、`npm run build` が成功する。
