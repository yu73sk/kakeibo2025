import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Settings({ onClose, monthlyBudget, onBudgetChange }) {
  const [budget, setBudget] = useState(monthlyBudget || 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setBudget(monthlyBudget || 0)
  }, [monthlyBudget])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    const budgetValue = parseFloat(budget)
    if (isNaN(budgetValue) || budgetValue < 0) {
      setError('有効な金額を入力してください')
      return
    }

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('ログインが必要です')
      }

      // 既存の設定を確認
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (existingSettings) {
        // 更新
        const { error } = await supabase
          .from('user_settings')
          .update({
            monthly_budget: budgetValue,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', session.user.id)

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('user_settings')
          .insert([{
            user_id: session.user.id,
            monthly_budget: budgetValue,
          }])

        if (error) throw error
      }

      // 親コンポーネントに予算変更を通知
      onBudgetChange(budgetValue)
      alert('予算を保存しました')
      onClose()
    } catch (error) {
      console.error('設定保存エラー:', error)
      setError(error.message || '設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">設定</h1>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            閉じる
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">月の予算</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="monthlyBudget" className="block text-sm font-medium text-gray-700 mb-2">
                  月間予算（円）
                </label>
                <input
                  type="number"
                  id="monthlyBudget"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  required
                  min="0"
                  step="1"
                />
                <p className="mt-2 text-sm text-gray-500">
                  この予算は全月共通で使用されます。予算を変更すると、今日の予実、今月の予実、日毎の予実表に反映されます。
                </p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gray-800 text-white py-3 px-6 rounded-2xl font-semibold hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-2xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Settings

