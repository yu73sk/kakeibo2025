# 家計簿2025

React、Tailwind CSS、Supabaseを使用した家計簿管理アプリです。
URL：https://kakeibo2025.vercel.app/

## 機能

- **予算按分計算**: 月間予算を曜日別比率で按分
  - 月〜木: 5%
  - 金: 19%
  - 土: 42%
  - 日: 19%
- **今日の予実**: 今日の予算と実績を表示
- **今月の予実**: 今月の累積予算と累積実績を表示
- **取引管理**: 取引の追加・編集・削除

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseの設定

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. `.env.local.example`を`.env.local`にコピー
3. Supabaseダッシュボードから以下を取得して`.env.local`に設定：
   - Project URL → `VITE_SUPABASE_URL`
   - API Key (anon/public) → `VITE_SUPABASE_ANON_KEY`

### 3. データベーステーブルの作成

SupabaseダッシュボードのSQL Editorで`supabase_setup.sql`の内容を実行してください。

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。

## ビルド

```bash
npm run build
```

## 技術スタック

- React 18
- Vite
- Tailwind CSS
- Supabase

