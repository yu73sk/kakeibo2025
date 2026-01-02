import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import { 
  getTodayBudget, 
  calculateMonthlyCumulativeBudget, 
  calculateMonthlyTotalBudget 
} from './utils/budgetCalculation'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [todayBudget, setTodayBudget] = useState(0)
  const [todayActual, setTodayActual] = useState(0)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [monthlyActual, setMonthlyActual] = useState(0)

  // 認証状態の確認
  useEffect(() => {
    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 認証状態の変更を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadTransactions()
      } else {
        setTransactions([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 今日の予算を計算
  useEffect(() => {
    if (session) {
      setTodayBudget(getTodayBudget())
      setMonthlyBudget(calculateMonthlyCumulativeBudget())
    }
  }, [session])

  // 取引履歴を読み込む
  useEffect(() => {
    if (session) {
      loadTransactions()
    }
  }, [session])

  // 今日の実績と今月の実績を計算
  useEffect(() => {
    calculateActuals()
  }, [transactions])

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('取引履歴の読み込みエラー:', error)
      alert('取引履歴の読み込みに失敗しました')
    }
  }

  const calculateActuals = () => {
    const today = new Date().toISOString().split('T')[0]
    
    // 今日の実績
    const todayTotal = transactions
      .filter(t => t.date === today)
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    setTodayActual(todayTotal)

    // 今月の実績（今日まで）
    const todayDate = new Date()
    const year = todayDate.getFullYear()
    const month = todayDate.getMonth() + 1
    const day = todayDate.getDate()

    const monthlyTotal = transactions
      .filter(t => {
        const tDate = new Date(t.date)
        return tDate.getFullYear() === year && 
               tDate.getMonth() + 1 === month && 
               tDate.getDate() <= day
      })
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    setMonthlyActual(monthlyTotal)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      alert('金額を入力してください')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // 編集
        const { error } = await supabase
          .from('transactions')
          .update({ date, amount: parseFloat(amount) })
          .eq('id', editingId)

        if (error) throw error
        setEditingId(null)
      } else {
        // 新規作成
        const { error } = await supabase
          .from('transactions')
          .insert([{ date, amount: parseFloat(amount), user_id: session.user.id }])

        if (error) throw error
      }

      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
      await loadTransactions()
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('ログアウトエラー:', error)
      alert('ログアウトに失敗しました')
    }
  }

  const handleEdit = (transaction) => {
    setEditingId(transaction.id)
    setDate(transaction.date)
    setAmount(transaction.amount.toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!confirm('この取引を削除しますか？')) return

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadTransactions()
    } catch (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const getDifference = (budget, actual) => {
    return actual - budget
  }

  const getDifferenceColor = (difference) => {
    if (difference > 0) return 'text-red-600'
    if (difference < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  // ローディング中
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    )
  }

  // ログインしていない場合はログイン画面を表示
  if (!session) {
    return <Login onLogin={() => {}} />
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            KAKEIBO
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            ログアウト
          </button>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            {editingId ? '取引を編集' : '新しい取引を追加'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  日付
                </label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  金額
                </label>
                <input
                  type="number"
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  required
                  min="0"
                  step="1"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gray-800 text-white py-3 px-6 rounded-2xl font-semibold hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? '保存中...' : editingId ? '更新' : '保存'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-2xl font-semibold hover:bg-gray-300 transition-colors"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* 今日の予実 */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">今日の予実</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">予算</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(todayBudget)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">実績</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(todayActual)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-1">差額</p>
            <p className={`text-xl font-bold ${getDifferenceColor(getDifference(todayBudget, todayActual))}`}>
              {formatCurrency(getDifference(todayBudget, todayActual))}
            </p>
          </div>
        </div>

        {/* 今月の予実 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">今月の予実（今日まで）</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">累積予算</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(monthlyBudget)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">累積実績</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(monthlyActual)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-1">差額</p>
            <p className={`text-xl font-bold ${getDifferenceColor(getDifference(monthlyBudget, monthlyActual))}`}>
              {formatCurrency(getDifference(monthlyBudget, monthlyActual))}
            </p>
          </div>
        </div>

        {/* 取引履歴 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">取引履歴</h2>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">取引履歴がありません</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      {formatCurrency(parseFloat(transaction.amount))}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors text-sm font-medium"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

