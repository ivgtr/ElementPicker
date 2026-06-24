# Element Picker

**Element Picker** は、開いているWebページ上のHTML要素を視覚的に選択し、選択した要素以下の内容を HTML / Markdown / テキスト としてコピーできる Chrome 拡張です。

- ページ上の要素をホバーしてコピー対象を確認
- 必要な範囲だけを HTML / Markdown / テキストでコピー
- `W` / `S` / `A` / `D` で親要素・子要素・兄弟要素へ選択範囲を調整
- クリックまたは `Enter` でコピー対象を確定
- DevTools を開かずに、ページの一部だけを素早く取り出せる

記事、ドキュメント、UI部品、表、カードなど、Webページの一部だけをノート・CMS・AIツールへ渡したいときに使うための小さなユーティリティです。

## 📦 インストール方法

### GitHub Releasesからインストール

1. [Releases ページ](https://github.com/ivgtr/ElementPicker/releases) にアクセス
2. 最新版の **Assets** から `element-picker-vX.Y.Z.zip` をダウンロード
3. 任意の場所に解凍
4. Chrome で `chrome://extensions/` を開く
5. 右上の「**デベロッパーモード**」を **ON** にする
6. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
7. 解凍したフォルダを選択

⚠️ **注意**: 開発者モードでインストールするため、Chrome起動時に警告が表示されますが、正常な動作です。

### 手動ビルド

```bash
# リポジトリをクローン
git clone https://github.com/ivgtr/ElementPicker.git
cd ElementPicker

# 依存関係をインストール
npm install

# ビルド
npm run build

# dist/ フォルダをChromeの拡張機能として読み込む
```

## 🚀 使い方

1. Element Picker の拡張機能アイコンをクリック
2. コピーしたいページ内の要素にカーソルを重ねる
3. 必要に応じてショートカットキーで選択範囲を調整
4. クリックまたは `Enter` で確定
5. 設定に応じて直接コピー、または `HTML` / `Markdown` / `Text` からコピー形式を選択

### ショートカット

| キー | 操作 |
|---|---|
| `W` | 親要素へ移動 |
| `S` | 子要素へ移動 |
| `A` | 前の兄弟要素へ移動 |
| `D` | 次の兄弟要素へ移動 |
| `Enter` | 現在の要素を確定 |
| `Esc` | 選択をキャンセル |

## 🚀 開発

### 開発コマンド

```bash
# 開発モード（ファイル監視+自動ビルド）
npm run dev

# プロダクションビルド
npm run build

# 型チェック
npm run type-check

# Lint
npm run lint

# フォーマット
npm run format
```

## 📄 ライセンス

MIT
