# Element Picker Interaction Revision Plan

## 目的

次フェーズの UI 方針を、よりシンプルな拡張機能として整理する。

採用する方針:

- Parent / Child / sibling 移動はボタンではなくショートカット操作にする。
- ショートカット説明は選択モード中、画面下部に簡易表示する。
- 要素確定後の形式選択メニューには Parent / Child ボタンを置かない。
- 設定は選択要素のポップアップ内に置かない。
- 設定アイコンは画面端に常設し、クリックで設定ポップアップを展開する。
- コピー前プレビューは採用しない。
- popup / options page は作らず、アイコンクリックで即選択開始する体験を維持する。

## 対象機能

### 1. ショートカットによる選択範囲移動

目的:

- 選択範囲を軽く調整できるようにする。
- 選択後に即コピーする設定を追加しても、クリック前に範囲調整できるようにする。
- 要素確定 UI をボタンで増やさず、コピー操作をシンプルに保つ。

操作:

- `W`: 親要素へ移動
- `S`: 子要素へ移動
- `A`: 前の兄弟要素へ移動
- `D`: 次の兄弟要素へ移動
- `Esc`: キャンセル、または開いている設定ポップアップを閉じる

操作対象:

- 選択モード中
- 要素確定後

設計方針:

- hover 中に `W` / `A` / `S` / `D` を使った場合は、hover 対象を起点に範囲移動する。
- 要素確定後に使った場合は、確定済み要素を起点に範囲移動する。
- 移動後は overlay を更新する。
- コピー対象は常に現在 overlay が示している要素と一致させる。
- wheel と ArrowUp / ArrowDown はページスクロールと競合するため、初期実装では範囲移動に使わない。
- sibling 移動は選択可能な兄弟要素だけを対象にする。
- sibling 移動で末端に到達した場合はループする。
- 移動できない場合は何もしない。必要なら軽いトーストで通知するが、初期実装では通知なしでもよい。

初期対応しない内容:

- DOM パンくず表示
- 子要素一覧ポップアップ
- ショートカットカスタマイズ

### 2. ショートカットヒント

目的:

- ショートカットを UI 上で自然に発見できるようにする。
- ボタンを増やさず、操作可能性だけを伝える。

表示タイミング:

- 拡張機能アイコンをクリックして選択モードに入った時点から表示する。
- コピー完了、キャンセル、cleanup で削除する。

表示位置:

- 画面下部の中央または左下。
- ページ内容を大きく邪魔しない固定表示。

表示内容:

```text
W/S parent/child   A/D siblings   Click select   Esc cancel
```

日本語 UI にする場合:

```text
W/S 親子移動   A/D 兄弟移動   Click 選択   Esc キャンセル
```

設計方針:

- 小さく、薄い背景で表示する。
- 選択対象から除外する。
- ページ側クリックに干渉しないようにする。
- text が長くなりすぎる場合は 2 行まで許容する。

### 3. 画面端の設定アイコンと設定ポップアップ

目的:

- 設定を選択要素の形式選択メニューから分離する。
- 今後設定項目が多少増えても破綻しない UI にする。
- アイコンクリックで即選択開始する体験は維持する。

表示タイミング:

- 選択モード中に常時表示する。
- 要素確定後も表示し続ける。
- コピー完了、キャンセル、cleanup で削除する。

表示位置:

- 初期案は右下。
- ショートカットヒントと干渉する場合は右上にする。
- 画面端から 12px 程度の余白を取る。

UI:

- 小さな歯車アイコンボタン
- クリックで設定ポップアップを展開
- 再クリックまたは Close で閉じる

設定ポップアップの初期項目:

- Default format
  - HTML
  - Markdown
  - Text

保存:

- `chrome.storage.local`
- 保存キーは `element-picker:settings`
- 初期値は `markdown`

設計方針:

- 設定ポップアップは選択対象から除外する。
- 設定ポップアップ内のクリック、pointer、wheel はページへ伝播させない。
- 設定ポップアップを閉じても選択状態は維持する。
- 設定変更は即保存する。
- 保存失敗時は toast で通知する。
- 将来設定が増えても並べられるよう、1 項目 1 行のフォームレイアウトにする。

初期対応しない内容:

- popup
- options page
- `chrome.storage.sync`
- 設定カテゴリ分け
- 設定検索

## UX フロー

### 通常コピー

```text
Icon click
  -> selecting
  -> shortcut hint and settings icon appear
  -> hover target
  -> optional W/A/S/D range adjustment
  -> click target
  -> format menu
  -> choose HTML / Markdown / Text
  -> copy
  -> toast
  -> cleanup
```

### 要素確定後の範囲調整

```text
Icon click
  -> selecting
  -> click target
  -> format menu
  -> W/A/S/D range adjustment
  -> overlay and selected target update
  -> choose format
  -> copy
```

### 設定変更

```text
Icon click
  -> selecting
  -> click edge gear icon
  -> settings popup opens
  -> choose default format
  -> save to chrome.storage.local
  -> close settings popup
  -> continue selecting
```

## 状態設計

既存の状態を大きく増やさず、設定ポップアップは UI の開閉状態として扱う。

```ts
type PickerState =
  | 'idle'
  | 'selecting'
  | 'format-selecting'
  | 'copying';
```

追加する UI 状態:

```ts
type PickerUiState = {
  settingsOpen: boolean;
};
```

方針:

- `settingsOpen` は選択状態とは別に持つ。
- 設定ポップアップが開いていても `selectedElement` や `hoveredElement` は維持する。
- `Esc` は設定ポップアップが開いていればまず閉じる。
- 設定ポップアップが閉じている状態で `Esc` を押すと選択モードをキャンセルする。

## ファイル構成案

```text
src/
  content/
    picker-controller.ts
    selection.ts
    settings.ts
    ui.ts
```

追加候補:

- `selection.ts`: 親要素・子要素移動、選択可能判定
- `settings.ts`: `chrome.storage.local` の読み書き、設定型、既定値

既存 `ui.ts` に追加する表示:

- shortcut hint
- settings edge button
- settings popup

`ui.ts` が肥大化する場合は、次のように分割する。

```text
src/content/ui/
  picker-ui.ts
  shortcut-hint.ts
  settings-popup.ts
```

初期実装では既存構成を優先し、必要になったら分割する。

## 選択移動設計

選択移動 helper の想定 API:

```ts
type SelectionDirection = 'parent' | 'child' | 'previous-sibling' | 'next-sibling';

const moveSelection = (
  element: HTMLElement,
  direction: SelectionDirection
): HTMLElement | null;
```

選択可能条件:

- `HTMLElement` である。
- 拡張機能が追加した UI ではない。
- `document.documentElement` ではない。
- `display: none` ではない。
- `visibility: hidden` ではない。
- `getBoundingClientRect()` の width / height が 0 ではない。

Parent:

- `parentElement` を上方向に辿る。
- 選択可能な最初の親要素を返す。
- `document.documentElement` には移動しない。

Child:

- `children` を DOM 順に探索する。
- 選択可能な最初の子孫 `HTMLElement` を返す。
- 直下に選択可能要素がない場合は深さ優先で探す。

Previous sibling:

- `previousElementSibling` を起点に兄弟要素を逆順に探索する。
- 選択可能な兄弟要素だけを対象にする。
- 先頭を超えた場合は末尾の選択可能な兄弟要素へループする。

Next sibling:

- `nextElementSibling` を起点に兄弟要素を順方向に探索する。
- 選択可能な兄弟要素だけを対象にする。
- 末尾を超えた場合は先頭の選択可能な兄弟要素へループする。

keyboard:

- `W`: parent
- `S`: child
- `A`: previous sibling
- `D`: next sibling
- 入力中の form control や settings popup 内では処理しない。
- 選択モード中は対象キーだけ `preventDefault()` し、ページ側ショートカットへ伝播させない。

## Settings 設計

設定モデル:

```ts
type PickerSettings = {
  defaultFormat: CopyFormat;
};
```

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

controller 起動時:

- `loadPickerSettings()` を呼ぶ。
- 読み込み失敗時は既定値を使う。

形式選択メニュー:

- 既定形式を強調表示する。
- 表示順は `defaultFormat` を先頭にするか、固定順のまま強調する。
- 初期実装では固定順のまま強調する。

設定ポップアップ:

- format 選択は segmented control または radio group。
- 変更時に `savePickerSettings()` を呼ぶ。
- 保存後に controller 内の settings state を更新する。
- 保存失敗時は既存設定を維持し toast を表示する。

## 実装パッケージ

### A. Shortcut Selection Navigation

作業:

- `selection.ts` を追加する。
- parent / child / sibling 移動 helper を実装する。
- controller に `keydown` の `W` / `A` / `S` / `D` 対応を追加する。
- 移動時に overlay とコピー対象を更新する。
- format menu 表示中でも移動できるようにする。
- Parent / Child ボタンは追加しない。

完了条件:

- `W` / `S` で親子移動できる。
- `A` / `D` で兄弟移動できる。
- sibling 移動は末端でループする。
- 移動後に overlay とコピー対象が一致する。
- 既存の click select と copy が壊れていない。

### B. Shortcut Hint UI

作業:

- `ui.ts` に shortcut hint 表示を追加する。
- 選択モード開始時に表示する。
- cleanup 時に削除する。
- 表示位置を画面下部に固定する。
- ページ操作を邪魔しない CSS にする。

完了条件:

- 選択モード中だけショートカット説明が表示される。
- コピー完了、キャンセル、cleanup で消える。
- 選択対象にならない。

### C. Edge Settings Popup

作業:

- `settings.ts` を追加する。
- 設定型、保存キー、既定値、load/save helper を実装する。
- `ui.ts` に画面端の settings button を追加する。
- `ui.ts` に settings popup を追加する。
- controller 起動時に settings を読み込む。
- settings popup で default format を変更できるようにする。
- 形式選択メニューで default format を強調表示する。

完了条件:

- 画面端の歯車アイコンから settings popup を開ける。
- default format を変更できる。
- 設定が `chrome.storage.local` に保存される。
- 次回選択モード開始時に反映される。
- settings popup は選択要素ポップアップ内に表示されない。

### D. Integration

作業:

- shortcut hint、settings button、format menu の表示位置が干渉しないように調整する。
- `W` / `A` / `S` / `D` とページ本来のショートカット抑止を確認する。
- settings popup 表示中の keyboard の扱いを確認する。
- cleanup 漏れを確認する。
- Windows 側 build で手動検証する。

完了条件:

- ショートカット移動と設定ポップアップが同時に使える。
- UI が過剰にリッチになっていない。
- アイコンクリックで即選択開始する体験が維持される。
- `npm run type-check`、`npm run lint`、`npm run build` が成功する。

## 検証計画

自動検証:

- `npm run type-check`
- `npm run lint`
- `npm run build`

手動検証:

- アイコンクリックで即選択モードに入る。
- 選択モード中にショートカットヒントが表示される。
- `W` で親要素に移動する。
- `S` で子要素に移動する。
- `A` で前の兄弟要素に移動する。
- `D` で次の兄弟要素に移動する。
- 兄弟要素移動は末端でループする。
- 移動後に overlay とコピー対象が一致する。
- 要素確定後の形式選択メニューに Parent / Child ボタンが表示されない。
- 画面端の歯車アイコンから settings popup を開ける。
- settings popup が選択要素のポップアップ内に表示されない。
- default format を変更できる。
- default format が次回選択モード開始時に反映される。
- settings popup を閉じても選択状態が維持される。
- `Esc` で settings popup を閉じられる。
- settings popup が閉じた状態で `Esc` を押すと選択モードがキャンセルされる。
- コピー完了、キャンセル後に overlay、hint、settings button、settings popup、event listener が残らない。

## リスクと注意点

- `W` / `A` / `S` / `D` は一部サイトの独自ショートカットと競合する可能性があるが、選択モード中のみ抑止する。
- WASD は Arrow キーよりスクロールと競合しにくい一方、非ゲーマーには発見しづらいためショートカットヒントで明示する。
- 画面端 settings button はページ UI と重なる可能性がある。
- ショートカットヒントと settings button の表示位置が干渉しないようにする。
- 設定ポップアップが開いている間は、ポップアップ内操作をページへ伝播させない。
- Parent / Child / sibling 移動はページ構造によって期待と異なる可能性がある。

## 完了条件

- Parent / Child / sibling 移動がボタンではなく `W` / `A` / `S` / `D` でできる。
- 選択モード中にショートカット説明が画面下部に表示される。
- Parent / Child ボタンは形式選択メニューに表示されない。
- 設定は選択要素ポップアップ内ではなく、画面端の設定アイコンから開ける。
- 設定項目が多少増えても破綻しにくいポップアップ構造になっている。
- アイコンクリックで即選択開始する体験が維持される。
- popup / options page / コピー前プレビューを追加していない。
