# 同期型ミュージックキュー再設計

**日付**: 2026-05-13

## 概要

現在のキューは `music_links` の一覧だけを Supabase Realtime で同期し、再生中位置と再生/停止状態は `MusicPanel` のローカル state で管理している。そのため、ホストが次の曲へ進めた時、再生中の前後に曲が追加された時、並び替えや削除が発生した時に、端末ごとに「再生中」と判断する曲がずれる。

この設計では、曲一覧と再生状態を別々の同期対象として扱う。`music_links` はキューの曲順、`music_playback_state` はセッション全体の現在曲と再生/停止を表す。ホストだけが再生状態を更新し、全参加者は同じ state を購読してキュー表示を更新する。

## 要件

- ホストの現在曲が全端末で同じ曲として表示される。
- ホストの再生/停止状態が共有 state に反映される。
- 非ホストは引き続き YouTube プレイヤーを表示しないが、キュー上の「再生中」表示は同期される。
- 曲追加、削除、並び替えは既存どおり参加者間で同期される。
- 曲終了または再生エラー時、ホストが現在曲をキューから削除し、次の曲へ進める。
- キューが空になったら現在曲を `null` にし、再生状態を停止にする。

## データモデル

`music_playback_state` テーブルを追加する。1セッションにつき1行だけを持つ。

```sql
create table public.music_playback_state (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  current_music_link_id uuid references public.music_links(id) on delete set null,
  is_playing boolean not null default false,
  updated_by_auth_id uuid not null,
  updated_at timestamptz not null default now()
);
```

Realtime 対象に追加する。

```sql
alter publication supabase_realtime add table public.music_playback_state;
```

RLS は同じセッション参加者の SELECT を許可し、UPDATE/INSERT はホストだけに許可する。既存の `sessions.host_auth_id` と `auth.uid()` を照合する。

## アプリ構成

### `useMusicLinks`

責務をキュー一覧の同期に限定する。`music_links` の INSERT/UPDATE/DELETE を購読し、`sort_order` 順の配列を返す。現在曲や再生状態の補正は持たない。

### `useMusicPlaybackState`

新規フックとして追加する。

```ts
interface MusicPlaybackState {
  session_id: string
  current_music_link_id: string | null
  is_playing: boolean
  updated_by_auth_id: string
  updated_at: string
}
```

返り値は次の形にする。

```ts
{
  state: MusicPlaybackState | null
  loading: boolean
  error: string | null
  setCurrent: (linkId: string | null, isPlaying: boolean) => Promise<boolean>
  setPlaying: (isPlaying: boolean) => Promise<boolean>
}
```

初期取得は Realtime 購読確立後に行う。まだ state 行がない場合は、ホスト操作時に upsert で作成する。

### `MusicPanel`

`currentIndex` を現在曲の source of truth にしない。現在曲は `playbackState.current_music_link_id` と `links` から導出する。

```ts
const currentIndex = links.findIndex(link => link.id === playbackState?.current_music_link_id)
const currentLink = currentIndex >= 0 ? links[currentIndex] : undefined
```

state が未作成、または `current_music_link_id` が削除済みの場合、ホストは先頭曲へ補正する。非ホストは補正せず、購読結果を待つ。

## 操作フロー

### 初回追加

キューが空の状態で曲が追加されたら、ホストが `current_music_link_id` を追加曲に設定し、`is_playing = true` にする。非ホストは state 更新を行わない。

### 再生/停止

ホストの再生/停止ボタンは `music_playback_state.is_playing` を更新する。`YouTubePlayer` には DB state 由来の `isPlaying` を渡す。

### 次へ/曲終了/エラー

ホストは現在曲を削除する前に、現在の `links` から次の曲を決める。次の曲があれば state をその曲に進めて `is_playing = true`、なければ `current_music_link_id = null`, `is_playing = false` にする。その後、終了した曲を削除する。

削除イベントが他端末へ届いた時も、すでに state は次の曲を指しているため、端末ごとの推測に依存しない。

### 前へ

ホストが前へ戻る場合、現在曲の前の曲IDへ state を更新する。キュー先頭なら末尾へ循環する。

### 並び替え

並び替えは `music_links.sort_order` の更新だけを行う。現在曲はIDで保持しているため、並び替え後も同じ曲が再生中として表示される。

### 削除

再生中でない曲の削除は既存どおり `music_links` を削除する。再生中曲を削除する場合は、ホスト操作なら次へ進める処理と同じ flow を使う。非ホストが自分の曲を削除し、それが現在曲だった場合はDBポリシー上削除できる可能性があるため、ホスト側の購読処理で state が削除済みIDを指していることを検出し、先頭または次候補へ補正する。

## エラー処理

- playback state の初期取得に失敗したら「キューの同期に失敗しました」を表示する。
- playback state の更新に失敗したらローカルだけで再生位置を進めず、DB state を維持する。
- state が存在しない状態で非ホストが表示した場合は、再生中ラベルを出さずにキューだけ表示する。
- state が削除済み曲IDを指している場合、ホストのみが補正 update を行う。

## テスト方針

- `useMusicPlaybackState.test.ts`
  - 購読確立後に初期取得する。
  - INSERT/UPDATE Realtime で state を更新する。
  - `setCurrent` が upsert を呼ぶ。
  - `setPlaying` が `is_playing` を更新する。

- `MusicPanel.test.tsx`
  - `current_music_link_id` の曲に `aria-current` が付く。
  - `currentIndex` ローカル state に依存しない。
  - ホストの再生/停止ボタンで playback state 更新を呼ぶ。
  - 曲終了時、次曲へ state を進めて現在曲を削除する。
  - 並び替え後も同じ曲IDが再生中として表示される。

- マイグレーション
  - `music_playback_state` テーブル、RLS、Realtime publication を追加する。

## スコープ外

- 秒単位の再生位置同期。
- 複数端末で同時に YouTube 音声を鳴らす機能。
- 音量やミュート状態の同期。
