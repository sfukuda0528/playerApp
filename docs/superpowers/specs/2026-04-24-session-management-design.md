# セッション管理 設計書

**プロジェクト**: CampCanvas
**作成日**: 2026-04-24
**対象機能**: FR-009 セッション管理

---

## 概要

グランピング参加者（最大4人）が同一セッションに集まり、写真・音楽を共有するためのセッションライフサイクル管理。

---

## 確定要件

| 項目 | 決定内容 |
|------|----------|
| 参加フロー | QRコード + 6桁数字コードの両方 |
| 認証方式 | 名前（ニックネーム）入力のみ。アカウント不要 |
| 有効期限 | 最終アクティビティから6時間で自動終了 |
| 最大参加人数 | 4人固定 |
| 終了権限 | 参加者全員（誰でも終了可能） |
| 途中参加 | セッションアクティブ中はいつでも参加可能 |

---

## アーキテクチャ

**方針**: DB中心 + Supabase Realtime購読

```
スマートフォン ─┐
               ├─ Supabase DB (sessions / participants)
タブレット/PC ──┘      ↕ Realtime WebSocket
                  Edge Function (scheduled: 5分ごと)
```

- セッション・参加者データはSupabase DBに永続化
- 状態変化（参加・終了）はRealtimeで全クライアントに即時反映
- 非アクティブ検知はEdge Function（Scheduled）が担当
- サーバーサイドのカスタムロジックはEdge Functionのみ。独自サーバーなし

---

## DBスキーマ

### sessions

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| code | char(6) | UNIQUE。参加コード |
| host_name | text | ホストのニックネーム |
| status | enum('active','ended') | |
| last_active_at | timestamptz | アクティビティ更新時に更新 |
| inactivity_timeout_min | int | デフォルト360（6時間） |
| created_at | timestamptz | |

### participants

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| session_id | uuid | FK → sessions.id |
| name | text | ニックネーム |
| joined_at | timestamptz | |

---

## 画面フロー

### ホスト側（タブレット/PC）

```
① トップ画面
  「セッション開始」ボタン
  ↓
② 名前入力
  ホストのニックネームを入力
  → sessions INSERT + participants INSERT（ホスト自身も登録）
  ↓
③ 招待画面
  QRコード + 6桁コード表示
  参加人数カウンター（Realtimeで更新）
  「スタート」ボタン（手動）→ メイン画面へ遷移
  ↓
④ メイン画面
  スライドショー再生
  右下に「＋メンバー」ボタン → タップでQRオーバーレイ表示
```

### 参加者側（スマートフォン）— 初回参加・途中参加共通

```
① トップ画面
  「セッションに参加」ボタン
  ↓
② コード入力
  QRスキャン（URLパラメータからコード自動取得）
  or 6桁コード手入力
  ↓
③ 名前入力
  ニックネームを入力
  ↓
④ アップロード画面
  写真・音楽を追加（即時利用可）
```

### 途中参加

- メイン画面の「＋メンバー」ボタンをタップするとQRオーバーレイを表示
- オーバーレイ表示中もスライドショーは背景で継続再生
- 閉じるボタン or 画面外タップでオーバーレイを非表示
- 参加者がINSERTされるとRealtimeで全員の参加者リストに即反映

### セッション終了

```
任意参加者が「セッション終了」タップ
  ↓
確認ダイアログ
  ↓
sessions.status = 'ended' UPDATE
  ↓
Realtimeで全員に通知
  ↓
モーメントログ生成へ遷移
```

---

## 非アクティビティ検知

`last_active_at` を更新するイベント:
- 写真アップロード
- 音楽アップロード
- 参加者のセッション参加

Edge Function（Supabase Scheduled Function）を**5分ごと**に実行:
- `last_active_at` から `inactivity_timeout_min` 分以上経過かつ `status = 'active'` のセッションを検索
- 対象セッションの `status` を `'ended'` に更新
- Realtimeで全員に通知 → モーメントログ生成へ自動遷移

---

## QRコード実装

- ライブラリ: `qrcode` npm パッケージ（クライアント側で生成）
- QRに埋め込むURL: `https://<app>/join/<6桁コード>`
- スキャン後: URLパラメータからコードを自動取得 → 名前入力画面へ直行
- フォールバック: QRスキャン不可の場合は同一画面内の手入力フォームを使用

---

## エラーハンドリング

| ケース | 挙動 |
|--------|------|
| 存在しないコード入力 | 「セッションが見つかりません」エラー表示 |
| 4人上限到達済み | 「このセッションは満員です」エラー表示 |
| セッション終了済み | 「このセッションはすでに終了しています」エラー表示 |
| Realtime接続断 | Supabase SDK標準の自動再接続。失敗時はトースト通知 |

---

## セキュリティ

**匿名認証の内部利用**
- UI上は名前入力のみだが、参加時にバックエンドでSupabase Anonymous Sign-Inを実行
- ユーザーには認証を意識させず、Supabase側でauth.uid()を発行
- 発行されたanon UIDをparticipants.auth_idカラムで紐付け

**RLS方針**
- `participants`テーブル: 自分のauth.uid()に紐づくセッションのデータのみ読み書き可
- `sessions`テーブル: コードが正しければ読み取り可（参加前のコード検証用）
- コードは6桁（100万通り）。短命セッションなのでブルートフォースリスクは低い

**participants テーブル追加カラム**

| カラム | 型 | 備考 |
|--------|-----|------|
| auth_id | uuid | Supabase anon auth.uid() |

---

## 制約・前提

- Supabase無料枠内で動作設計
- Supabase Scheduled Functionsの最小実行間隔（1分）以上の検知精度
- クライアントはRealtimeのWebSocket接続を維持（モバイル回線でも動作想定）
