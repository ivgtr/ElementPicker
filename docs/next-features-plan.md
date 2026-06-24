# Element Picker Next Features Plan

## 目的

初期リリースの要素選択、形式選択、コピー機能を土台に、次の 2 機能を追加する。

- 選択範囲の親要素・子要素への移動
- 選択モード内の設定メニュー

いずれも `docs/requirements.md` の将来検討項目に含まれる機能であり、ページ上での操作を完結させる。設定ページは作らず、選択モード中に歯車ボタンから開く軽量な設定メニューで対応する。

コピー前プレビューは、拡張機能がリッチになりすぎるため採用しない。操作は「選択、必要なら範囲調整、形式選択、コピー」の軽い流れを維持する。

## 実装スコープ

### 選択範囲の親要素・子要素への移動

目的:

- クリック確定後に、選択範囲が少し狭い、または広い場合の調整をできるようにする。
- 要素選択のやり直しを減らす。

実装する内容:

- 要素確定後の操作メニューに `Parent` / `Child` を追加する。
- `Parent` は現在の選択要素の `parentElement` へ移動する。
- `Child` は現在の選択要素の代表的な子要素へ移動する。
- 移動後は overlay とコピー対象を更新する。
- 移動できない場合はボタンを disabled にする。

設計方針:

- `html` は選択対象外のままにする。
- `body` への移動は許可するが、ページ全体コピーに近くなるため overlay 表示で範囲を明確にする。
- 子要素候補は初期実装では先頭の表示可能な `HTMLElement` にする。
- 将来、`Previous` / `Next` / 子候補一覧へ拡張できるように、選択移動ロジックは controller 内に閉じず helper 化できる形にする。

初期対応しない内容:

- 兄弟要素への移動
- 子要素一覧ポップオーバー
- DOM パンくず表示
- キーボードショートカットによる階層移動

### 選択モード内の設定メニュー

目的:

- 毎回の操作をユーザーの好みに寄せる。
- 設定ページを追加せず、選択モード内で軽く変更できるようにする。

実装する内容:

- 選択モード中または要素確定後の UI に歯車ボタンを表示する。
- 歯車ボタンから設定メニューを開く。
- 設定メニューで既定のコピー形式を選べる。
- 既定形式は `chrome.storage.local` に保存する。
- 次回の選択モード開始時に保存済みの既定形式を読み込む。
- 形式選択 UI では既定形式を視覚的に分かるようにする。

初期設定項目:

- Default format: `HTML` / `Markdown` / `Text`

将来追加候補:

- コピー後に選択モードを継続するか
- HTML コピーを `outerHTML` / `innerHTML` で切り替えるか
- Markdown 変換で URL を絶対化するか
- Markdown 変換で不要要素を除外するか

初期対応しない内容:

- options page
- popup
- 設定の同期
- 複雑な設定カテゴリ

## UX フロー

### 通常フロー

```text
Icon click
  -> selecting
  -> hover target
  -> click target
  -> selected menu
  -> optional Parent or Child
  -> choose format
  -> copy
  -> toast
  -> cleanup
```

### 範囲調整フロー

```text
Icon click
  -> selecting
  -> click target
  -> selected menu
  -> Parent or Child
  -> overlay updates
  -> choose format
  -> Copy
```

### 設定フロー

```text
Icon click
  -> selecting
  -> gear button
  -> settings menu
  -> choose default format
  -> save to chrome.storage.local
  -> continue selecting
```

## 技術設計

### 状態管理

既存の `PickerState` を次のように拡張する。

```ts
type PickerState =
  | 'idle'
  | 'selecting'
  | 'selected'
  | 'settings'
  | 'copying';
```

状態の役割:

- `selecting`: hover とクリック確定を受け付ける。
- `selected`: 対象要素が確定し、形式選択、Parent、Child、設定、Cancel を表示する。
- `settings`: 設定メニューを表示する。閉じたら元の状態に戻る。
- `copying`: clipboard 書き込み中。

設定メニューは一時的な overlay UI なので、実装上は `previousStateBeforeSettings` のような退避状態を持つ。

### ファイル構成

既存構成を維持し、必要に応じて helper を追加する。

```text
src/
  content/
    content-script.ts
    picker-controller.ts
    copy.ts
    markdown.ts
    ui.ts
    selection.ts
    settings.ts
  shared/
    messages.ts
```

追加候補:

- `content/selection.ts`: 親要素・子要素移動、選択可能判定
- `content/settings.ts`: `chrome.storage.local` から設定を読み書き

`ui.ts` は肥大化しやすいため、次のいずれかの方針を取る。

- 小規模なら既存 `PickerUi` に selected menu/settings 表示メソッドを追加する。
- 見通しが悪くなる場合は `ui/` ディレクトリへ分割する。

初期実装では過剰分割を避け、`ui.ts` が読みにくくなった時点で分割する。

### 設定モデル

```ts
type PickerSettings = {
  defaultFormat: CopyFormat;
};
```

保存先:

- `chrome.storage.local`

保存キー:

```ts
const PICKER_SETTINGS_STORAGE_KEY = 'element-picker:settings';
```

既定値:

```ts
const DEFAULT_PICKER_SETTINGS: PickerSettings = {
  defaultFormat: 'markdown',
};
```

`markdown` を既定値にする理由:

- この拡張の想定用途である AI ツール、ノート、ドキュメント作成に最も再利用しやすい。
- HTML が必要なユーザーは明示的に選べる。

### 範囲移動

選択移動 helper の想定 API:

```ts
const getSelectableParent = (element: HTMLElement): HTMLElement | null;
const getSelectableChild = (element: HTMLElement): HTMLElement | null;
```

選択可能条件:

- `HTMLElement` である。
- 拡張機能が追加した UI ではない。
- `document.documentElement` ではない。
- `display: none` ではない。
- `visibility: hidden` ではない。
- `getBoundingClientRect()` の width / height が 0 ではない。

### UI 設計

#### Selected Menu

要素確定後に表示する操作:

- `HTML`
- `Markdown`
- `Text`
- `Parent`
- `Child`
- Gear
- `Cancel`

設計方針:

- 形式ボタンは短いラベルを維持する。
- 既定形式は強調表示する。
- `Parent` / `Child` は移動不可なら disabled にする。
- Gear はテキストではなく記号またはアイコン的なボタンにする。アクセシブル名は `Settings` とする。

#### Settings Menu

表示内容:

- Default format
- `HTML`
- `Markdown`
- `Text`
- `Close`

設計方針:

- 選択モード中の小さな popover として実装する。
- 設定変更は即保存する。
- 保存成功/失敗は小さく通知する。
- 設定メニューを閉じても選択状態を失わない。

## 実装順序

次の作業パッケージに分けて進める。`Foundation` 完了後は、`Selection Navigation` と `Settings Menu` を並列に進められるようにする。

### 0. Foundation

目的:

- 2 機能を追加しやすい状態管理と UI 接続点を先に整える。
- 後続作業が同じ箇所を大きく書き換えないようにする。

作業:

- `PickerState` を `selected` / `settings` へ拡張できる形にする。
- クリック確定後に `selectedElement` を保持し、選択確定 UI を表示する入口を作る。
- `PickerUi` に menu/panel 系 UI を差し替え表示できる内部 API を用意する。
- controller と UI の callback 型を整理する。
- cleanup、Esc、再起動時の基本動作を維持する。

完了条件:

- 既存の HTML / Markdown / Text コピー動線が壊れていない。
- 後続機能が `PickerController` と `PickerUi` の決まった入口から追加できる。

検証:

- `npm run type-check`
- `npm run lint`
- `npm run build`
- 既存の選択、コピー、キャンセルが動くこと。

### 1. Selection Navigation

依存:

- `Foundation`

目的:

- 選択確定後に対象要素を Parent / Child へ移動できるようにする。

作業:

- `content/selection.ts` を追加する。
- `getSelectableParent` / `getSelectableChild` を実装する。
- selected menu に `Parent` / `Child` を追加する。
- 移動不可の場合の disabled 状態を UI に渡す。
- 移動時に `selectedElement`、overlay、対象要素ラベルを更新する。

他パッケージとの境界:

- コピー形式選択後のコピー処理は扱わない。
- Settings の保存や既定形式は扱わない。
- 子要素候補一覧や兄弟移動は扱わない。

完了条件:

- Parent で親要素へ移動できる。
- Child で代表的な子要素へ移動できる。
- 移動できない場合はボタンが disabled になる。
- 移動後にコピー対象が更新される。

### 2. Settings Menu

依存:

- `Foundation`

目的:

- 選択モード内の歯車メニューで既定コピー形式を設定できるようにする。

作業:

- `content/settings.ts` を追加する。
- `PickerSettings`、保存キー、既定値を定義する。
- `chrome.storage.local` から設定を読み込む。
- `chrome.storage.local` へ設定を保存する。
- selected menu または selecting UI に Gear ボタンを追加する。
- `PickerUi` に settings menu を追加する。
- default format を selected menu 上で強調表示する。

他パッケージとの境界:

- options page / popup は作らない。
- プレビュー関連の設定は実装しない。
- 形式選択後は既存どおり即コピーする。

完了条件:

- Gear から settings menu を開ける。
- default format を変更できる。
- 設定が `chrome.storage.local` に保存される。
- 次回選択モード開始時に default format が反映される。
- settings menu を閉じても選択状態が失われない。

### 3. Integration

依存:

- `Selection Navigation`
- `Settings Menu`

目的:

- 並列に入れた 2 機能を一つの自然な操作体験に統合する。

作業:

- selected menu の操作順、表示密度、disabled 表示を調整する。
- Settings 表示中の Esc / 外側クリック / Cancel の動作を統一する。
- すべての一時 UI が cleanup されることを確認する。
- 手動検証で見つかった UI 文言や配置を調整する。

完了条件:

- 2 機能を同時に使っても状態が破綻しない。
- overlay、menu、settings、event listener が終了後に残らない。
- Windows 側 build で手動確認できる。

### 並列化ルール

- `Foundation` は最初に単独で実施する。
- `Selection Navigation` と `Settings Menu` は `Foundation` 後に並列化可能。
- `Integration` は 2 パッケージ完了後に実施する。
- 各パッケージは可能な限り別ファイルを中心に変更する。
- `PickerController` と `PickerUi` は競合しやすいため、各パッケージで触る入口を事前に限定する。
- 各パッケージごとに `type-check` と `lint` を通す。最終統合で `build` と手動検証を行う。

## 検証計画

自動検証:

- `npm run type-check`
- `npm run lint`
- `npm run build`

手動検証:

- 要素選択後に selected menu が表示されること。
- `Parent` で親要素へ移動し、overlay が更新されること。
- `Child` で子要素へ移動し、overlay が更新されること。
- 移動できない場合にボタンが disabled になること。
- HTML / Markdown / Text の各形式を選ぶとコピーされること。
- 歯車から settings menu を開けること。
- default format を変更し、次回選択モード開始時にも反映されること。
- settings menu を閉じても選択状態が維持されること。
- `Esc` で状態に応じて閉じる、またはキャンセルできること。
- 終了後に overlay、menu、settings、event listener が残らないこと。

## リスクと注意点

- UI が増えるため、`ui.ts` が肥大化しやすい。
- `chrome.storage.local` は content script から使えるが、型とエラー処理を明確にする必要がある。
- Gear/settings UI がページ本来のクリックを発火させないよう、既存のイベント抑止を維持する必要がある。
- Parent / Child 移動はページ構造によって期待と異なる可能性がある。
- 選択後に元ページ DOM が変化した場合、overlay 対象やコピー対象がズレる可能性がある。

## 完了条件

- 選択範囲を Parent / Child で調整できる。
- HTML / Markdown / Text を選ぶとコピーできる。
- 選択モード内の設定メニューで既定形式を変更できる。
- 設定が次回の選択モードに反映される。
- 設定ページ、popup、options page を追加していない。
- `npm run type-check`、`npm run lint`、`npm run build` が成功する。
