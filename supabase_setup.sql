-- Supabaseで実行するSQL
-- SupabaseのダッシュボードのSQL Editorで実行してください

-- transactionsテーブルを作成
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを追加（検索パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Row Level Security (RLS) を有効化
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow all operations for all users" ON transactions;

-- 自分のデータのみ読み取り可能なポリシー
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 自分のデータのみ挿入可能なポリシー
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分のデータのみ更新可能なポリシー
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 自分のデータのみ削除可能なポリシー
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- user_settingsテーブルを作成
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Row Level Security (RLS) を有効化
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 自分の設定のみ読み取り可能なポリシー
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- 自分の設定のみ挿入可能なポリシー
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分の設定のみ更新可能なポリシー
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- cashflowテーブルを作成
CREATE TABLE IF NOT EXISTS cashflow (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  category_name VARCHAR(100) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_fixed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month, type, category_name)
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_cashflow_user_id ON cashflow(user_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_year_month ON cashflow(year, month);
CREATE INDEX IF NOT EXISTS idx_cashflow_type ON cashflow(type);

-- Row Level Security (RLS) を有効化
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;

-- 自分のキャッシュフローのみ読み取り可能なポリシー
CREATE POLICY "Users can view own cashflow" ON cashflow
  FOR SELECT
  USING (auth.uid() = user_id);

-- 自分のキャッシュフローのみ挿入可能なポリシー
CREATE POLICY "Users can insert own cashflow" ON cashflow
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分のキャッシュフローのみ更新可能なポリシー
CREATE POLICY "Users can update own cashflow" ON cashflow
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 自分のキャッシュフローのみ削除可能なポリシー
CREATE POLICY "Users can delete own cashflow" ON cashflow
  FOR DELETE
  USING (auth.uid() = user_id);

