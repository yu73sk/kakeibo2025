import { createClient } from '@supabase/supabase-js'

// SupabaseのURLとAPIキーを環境変数から取得
// 実際の値は .env.local ファイルに設定してください
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabaseの環境変数が設定されていません。')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '設定済み' : '未設定')
  console.error('デプロイ環境では、環境変数を正しく設定してください。')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // セッションをブラウザのlocalStorageに保存して永続化
    // これにより、ブラウザを閉じてもログイン状態が保持されます
    persistSession: true,
    
    // トークンの有効期限が切れる前に自動的にリフレッシュ
    // アプリを定期的に開くことで、実質的に1ヶ月以上のログイン状態を維持可能
    autoRefreshToken: true,
    
    // URLからセッションを検出（メール認証リンクなどで使用）
    detectSessionInUrl: true,
    
    // ブラウザのlocalStorageを使用してセッションを保存
    // サーバーサイドレンダリング（SSR）環境でも安全に動作するように条件分岐
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    
    // ストレージに保存する際のキー名
    storageKey: 'supabase.auth.token',
  },
})

