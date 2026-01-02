import { createClient } from '@supabase/supabase-js'

// SupabaseのURLとAPIキーを環境変数から取得
// 実際の値は .env.local ファイルに設定してください
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabaseの環境変数が設定されていません。.env.localファイルを確認してください。')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

