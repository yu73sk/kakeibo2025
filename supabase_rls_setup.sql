-- Supabase RLS設定用SQL
-- 既存のテーブルに対してRLSを設定する場合に使用してください
-- SupabaseのダッシュボードのSQL Editorで実行してください

-- ============================================
-- transactionsテーブルのRLS設定
-- ============================================

-- RLSを有効化
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
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

-- ============================================
-- user_settingsテーブルのRLS設定
-- ============================================

-- RLSを有効化
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Allow all operations for all users" ON user_settings;

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

-- ============================================
-- cashflowテーブルのRLS設定
-- ============================================

-- RLSを有効化
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can view own cashflow" ON cashflow;
DROP POLICY IF EXISTS "Users can insert own cashflow" ON cashflow;
DROP POLICY IF EXISTS "Users can update own cashflow" ON cashflow;
DROP POLICY IF EXISTS "Users can delete own cashflow" ON cashflow;
DROP POLICY IF EXISTS "Allow all operations for all users" ON cashflow;

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

