# UI リデザイン — ウォームモダン + FontAwesome

**日付:** 2026-05-10  
**対象:** 全画面  
**方針:** B — リッチカード＋アニメーション

---

## 概要

現行の CampCanvas UI に対して、既存カラーパレットを維持しつつ以下を追加する。

- グラデーションヘッダー・CTA ボタン
- カード影・border-radius の強化
- タップフィードバックアニメーション（`active:scale-95`）
- タブ切り替えフェード（200ms）
- 再生中キューアイテムの視覚強調
- 全絵文字アイコン → Font Awesome に統一

ロジック・テスト・型定義は変更しない。

---

## カラー・シャドウ定義

既存の CSS 変数（`index.css`）は変更しない。新規グラデーション・シャドウは Tailwind の `class` で直接記述する。

| 用途 | 値 |
|---|---|
| ヘッダーグラデーション | `linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)` |
| CTA グラデーション | `linear-gradient(135deg, #e07b39, #c8601a)` |
| プレイヤー背景 | `linear-gradient(160deg, #1a0800, #3d1c06)` |
| ホバー/タップ影（ボタン） | `0 6px 18px rgba(224,123,57,0.45)` |
| カード影 | `0 4px 14px rgba(124,74,30,0.14)` |
| input focus glow | `box-shadow: 0 0 0 3px rgba(224,123,57,0.12)` |

---

## Font Awesome パッケージ

```
@fortawesome/fontawesome-svg-core
@fortawesome/free-solid-svg-icons
@fortawesome/free-brands-svg-icons   ← fa-youtube 用
@fortawesome/react-fontawesome
```

### アイコン対応表

| 絵文字 / 旧表現 | Font Awesome アイコン |
|---|---|
| 🏕 | `faCampground` |
| 📸 | `faCamera` |
| 🎵 | `faMusic` |
| 👥 | `faUsers` |
| 👑 | `faCrown` |
| ⠿（ドラッグハンドル）| `faGripVertical` |
| ✕（削除）| `faXmark` |
| 🔍（検索）| `faMagnifyingGlass` |
| ←（戻る）| `faChevronLeft` |
| ▶ / ⏸ | `faPlay` / `faPause` |
| ⏮ / ⏭ | `faBackwardStep` / `faForwardStep` |
| 📷（通知）| `faCamera` |
| YouTube ロゴ | `faYoutube`（brands）|
| 音量（再生中バッジ）| `faVolumeHigh` |
| キューラベル | `faList` |
| 参加ボタン | `faRightToBracket` |

`showToast` 内の文字列に含まれる絵文字（📷 🎵）は、トーストを JSX ベースに変更して FA アイコンに置き換える。

---

## 画面別変更仕様

### TopPage

- ヘッダー: グラデーション背景 + `radial-gradient` グロウ（下部）
- `faCampground` アイコン: `drop-shadow` でオレンジ発光
- 「セッション開始」ボタン: グラデーション塗り + ダブルシャドウ + `fa-play` アイコン
- 「セッションに参加」ボタン: 白グラデ背景 + orange border + `fa-right-to-bracket` アイコン
- 全ボタン: `active:scale-95 transition-all duration-150`

### SessionCreate / SessionJoin

- ヘッダー: グラデーション統一（TopPage と同系）
- 戻るボタン: `fa-chevron-left` アイコン
- フォームカード: 白背景、`border-radius: 18px`、`box-shadow: 0 6px 24px rgba(124,74,30,0.14)`
- input: フォーカス時 orange border（2px）+ glow ring
- ラベル: `fa-user` アイコン付き、`letter-spacing` 追加
- 送信ボタン: グラデーション + シャドウ + `fa-campground` アイコン

### InviteScreen

- QRコードカード: 白背景 + 影
- 参加コードバッジ: グラデーション背景

### MainPage

- ヘッダー: グラデーション + 参加者数をピルバッジ（`fa-users` + `2/4`）
- タブバー: アクティブタブを「下線」→「ピル型塗りハイライト」に変更
- タブアイコン: `faCamera` / `faMusic` / `faUsers`
- タブ切り替え: `transition-opacity duration-200`（TabsContent に追加）
- トースト: グラデ背景 + 上からスライドイン（`animate-slide-down`、`index.css` に定義）
- メンバーリスト: ホストに `faCrown`（gold色）

### MusicPanel

- プレイヤー領域背景: `#1a0800 → #3d1c06` グラデーション（コントラスト強化）
- 再生ボタン: 円形グラデ + `box-shadow` グロウ、`fa-play` / `fa-pause`
- スキップボタン: `fa-backward-step` / `fa-forward-step`
- YouTube ブランドアイコン: `fa-youtube`（brands）をプレイヤー内に表示
- キューアイテム（通常）: 白カード + `box-shadow` + `fa-grip-vertical` + `fa-xmark`
- キューアイテム（再生中）: 左3px カラーバー（`#e07b39 → #c8954a`）+ 「再生中」バッジ（`fa-volume-high`）
- 検索フォーム: `fa-magnifying-glass` ボタンアイコン
- 検索結果カード: 既存レイアウト維持、タップ時 `active:shadow-md` へ遷移
- URL 追加フォーム: 既存レイアウト維持、ボタンをグラデ化
- キューラベル: `fa-list` アイコン付き

---

## アニメーション仕様

| 対象 | アニメーション |
|---|---|
| 全ボタン | `active:scale-95 transition-all duration-150` |
| カード（タップ）| `active:shadow-lg transition-shadow duration-200`（モバイル向け）|
| タブコンテンツ | `transition-opacity duration-200` |
| トースト | スライドイン（CSS keyframes、`index.css` に追加） |
| 再生中バッジ | パルスグロウ（CSS keyframes、`index.css` に追加） |

```css
/* index.css に追加する keyframes */
@keyframes slide-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(224,123,57,0); }
  50%       { box-shadow: 0 0 0 4px rgba(224,123,57,0.25); }
}
```

---

## 実装方針

- 既存コンポーネントのみ変更（新ファイル作成なし）
- `index.css` に keyframes 2件・slide-down アニメユーティリティを追加
- FontAwesome は `FontAwesomeIcon` コンポーネントを各ファイルで import して使用
- トースト JSX 化: `MainPage.tsx` の `toast.message` を `string` から `ReactNode` に変更し、絵文字の代わりに FA アイコンを使う
- テスト・型定義・hooks は変更しない

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `package.json` | FontAwesome 4パッケージ追加 |
| `src/index.css` | keyframes 追加 |
| `src/components/TopPage.tsx` | グラデ・FAアイコン |
| `src/components/SessionCreate.tsx` | グラデ・FAアイコン |
| `src/components/SessionJoin.tsx` | グラデ・FAアイコン |
| `src/components/InviteScreen.tsx` | カード影・グラデ |
| `src/components/MainPage.tsx` | ヘッダー・タブ・トースト JSX 化 |
| `src/components/MusicPanel.tsx` | プレイヤー・キュー・FAアイコン |
| `src/components/YouTubePlayer.tsx` | ◀/⏸/▶/▶▶ → `faBackwardStep` / `faPause` / `faPlay` / `faForwardStep`、コントロール div にスタイル追加 |
