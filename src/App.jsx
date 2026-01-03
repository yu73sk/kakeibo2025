import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Settings from './components/Settings'
import Cashflow from './components/Cashflow'
import { 
  getTodayBudget, 
  calculateMonthlyCumulativeBudget, 
  calculateMonthlyTotalBudget,
  calculateDailyBudget
} from './utils/budgetCalculation'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showCashflow, setShowCashflow] = useState(false)
  const [monthlyBudgetSetting, setMonthlyBudgetSetting] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [todayBudget, setTodayBudget] = useState(0)
  const [todayActual, setTodayActual] = useState(0)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [monthlyActual, setMonthlyActual] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'))
  const [showOldTransactions, setShowOldTransactions] = useState(false)
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState(new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'))
  const [showOlderMonths, setShowOlderMonths] = useState(false)

  // 認証状態の確認
  useEffect(() => {
    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('初期セッション取得:', session?.user?.id)
      setSession(session)
      setLoading(false)
      if (session) {
        loadUserSettings()
        loadTransactions()
      } else {
        // セッションがない場合、状態をクリア
        setTransactions([])
        setMonthlyBudgetSetting(0)
      }
    })

    // 認証状態の変更を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('認証状態変更:', _event, session?.user?.id)
      setSession(session)
      if (session) {
        // セッションが変更されたら、データを再読み込み
        loadTransactions()
        loadUserSettings()
      } else {
        // ログアウト時は状態をクリア
        setTransactions([])
        setMonthlyBudgetSetting(0)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ユーザー設定を読み込む
  const loadUserSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('user_settings')
        .select('monthly_budget')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116はデータが見つからないエラー
        console.error('設定読み込みエラー:', error)
        return
      }

      if (data) {
        setMonthlyBudgetSetting(parseFloat(data.monthly_budget) || 0)
      } else {
        setMonthlyBudgetSetting(0)
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error)
    }
  }

  // 予算設定が変更されたときに予算を再計算
  useEffect(() => {
    if (session && monthlyBudgetSetting >= 0) {
      setTodayBudget(getTodayBudget(monthlyBudgetSetting))
      setMonthlyBudget(calculateMonthlyCumulativeBudget(monthlyBudgetSetting))
    }
  }, [session, monthlyBudgetSetting])

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
      // セッションを明示的に取得
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !session.user) {
        console.log('セッションなし、取引履歴をクリア')
        setTransactions([])
        return
      }

      console.log('取引履歴読み込み - ユーザーID:', session.user.id)
      console.log('取引履歴読み込み - メール:', session.user.email)

      // 現在のユーザーのIDでフィルタリング
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('取引履歴読み込みエラー:', error)
        throw error
      }

      console.log('取得した取引履歴数:', data?.length || 0)
      console.log('取得した取引履歴のuser_id:', data?.map(t => t.user_id) || [])
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

    if (!session || !session.user) {
      alert('ログインが必要です。ページをリロードしてください。')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // 編集
        const { data, error } = await supabase
          .from('transactions')
          .update({ date, amount: parseFloat(amount) })
          .eq('id', editingId)
          .select()

        if (error) {
          console.error('更新エラー詳細:', error)
          throw new Error(`更新に失敗しました: ${error.message || JSON.stringify(error)}`)
        }
        
        if (!data || data.length === 0) {
          throw new Error('更新されたデータが見つかりませんでした。権限を確認してください。')
        }
        
        setEditingId(null)
      } else {
        // 新規作成
        const insertData = {
          date,
          amount: parseFloat(amount),
          user_id: session.user.id
        }
        
        console.log('保存データ:', insertData)
        console.log('セッション:', session.user.id)
        
        const { data, error } = await supabase
          .from('transactions')
          .insert([insertData])
          .select()

        if (error) {
          console.error('挿入エラー詳細:', error)
          console.error('エラーコード:', error.code)
          console.error('エラーメッセージ:', error.message)
          console.error('エラー詳細:', error.details)
          throw new Error(`保存に失敗しました: ${error.message || JSON.stringify(error)}`)
        }
        
        if (!data || data.length === 0) {
          throw new Error('データが保存されませんでした。権限を確認してください。')
        }
        
        console.log('保存成功:', data)
      }

      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
      await loadTransactions()
    } catch (error) {
      console.error('保存エラー:', error)
      const errorMessage = error.message || '保存に失敗しました。ブラウザのコンソールを確認してください。'
      alert(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      // セッションを明示的にクリア
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // 状態をリセット
      setSession(null)
      setTransactions([])
      setMonthlyBudgetSetting(0)
      
      // ページをリロードして確実にセッションをクリア
      window.location.reload()
    } catch (error) {
      console.error('ログアウトエラー:', error)
      alert(`ログアウトに失敗しました: ${error.message || '不明なエラー'}`)
      
      // エラーが発生しても強制的にリロード
      window.location.reload()
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

  // 日毎の予実データを生成
  const getDailyBudgetData = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const dailyData = []

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // 予算を計算（現在の予算設定を使用）
      const budget = calculateDailyBudget(date, monthlyBudgetSetting)
      
      // 実績を計算（その日の取引の合計）
      const actual = transactions
        .filter(t => t.date === dateStr)
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
      
      // 差分
      const difference = actual - budget

      dailyData.push({
        date: dateStr,
        day,
        weekday: date.getDay(),
        weekdayName: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()],
        budget,
        actual,
        difference,
      })
    }

    return dailyData
  }

  // 選択された月のデータを取得
  const selectedYear = parseInt(selectedMonth.split('-')[0])
  const selectedMonthNum = parseInt(selectedMonth.split('-')[1])
  const dailyData = getDailyBudgetData(selectedYear, selectedMonthNum)

  // 合計値を計算
  const totalBudget = dailyData.reduce((sum, day) => sum + day.budget, 0)
  const totalActual = dailyData.reduce((sum, day) => sum + day.actual, 0)
  const totalDifference = totalActual - totalBudget

  // 週次予実進捗データを生成
  const getWeeklyProgressData = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const weeks = []
    
    // 週の定義
    const weekRanges = [
      { start: 1, end: 7, label: '1W' },
      { start: 8, end: 14, label: '2W' },
      { start: 15, end: 21, label: '3W' },
      { start: 22, end: 28, label: '4W' },
      { start: 29, end: daysInMonth, label: '5W' },
    ]

    let cumulativeBudget = 0
    let cumulativeActual = 0

    weekRanges.forEach((week, index) => {
      // その週の予算と実績を計算
      let weekBudget = 0
      let weekActual = 0

      for (let day = week.start; day <= Math.min(week.end, daysInMonth); day++) {
        const date = new Date(year, month - 1, day)
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        
        // 予算を計算
        weekBudget += calculateDailyBudget(date, monthlyBudgetSetting)
        
        // 実績を計算
        weekActual += transactions
          .filter(t => t.date === dateStr)
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
      }

      // 累積値を更新
      cumulativeBudget += weekBudget
      cumulativeActual += weekActual

      // 進捗率を計算（累積実績 ÷ 累積予算）
      const progressRate = cumulativeBudget > 0 ? (cumulativeActual / cumulativeBudget) * 100 : 0

      // 残金を計算
      const remaining = cumulativeBudget - cumulativeActual

      // 状況を判定（進捗率が100%を超えている場合はビハインド）
      const status = progressRate > 100 ? 'ビハインド' : '予算内'

      weeks.push({
        period: week.label,
        budget: weekBudget,
        actual: weekActual,
        cumulativeBudget,
        cumulativeActual,
        progressRate,
        remaining,
        status,
      })
    })

    return weeks
  }

  // 今月の週次データを取得
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const weeklyData = getWeeklyProgressData(currentYear, currentMonth)

  // 表示可能な月のリストを生成（過去6ヶ月から未来3ヶ月まで）
  const getAvailableMonths = () => {
    const months = []
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1

    // 過去6ヶ月
    for (let i = 6; i >= 1; i--) {
      const date = new Date(currentYear, currentMonth - i - 1, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${year}年${month}月`,
      })
    }

    // 今月
    months.push({
      value: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
      label: `${currentYear}年${currentMonth}月`,
    })

    // 未来3ヶ月
    for (let i = 1; i <= 3; i++) {
      const date = new Date(currentYear, currentMonth + i - 1, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${year}年${month}月`,
      })
    }

    return months
  }

  const availableMonths = getAvailableMonths()

  // ユーザー名を取得（メールアドレスの@以前の部分）
  const getUserName = () => {
    if (!session || !session.user || !session.user.email) {
      return 'ゲスト'
    }
    const email = session.user.email
    const atIndex = email.indexOf('@')
    if (atIndex === -1) {
      return 'ゲスト'
    }
    return email.substring(0, atIndex)
  }

  const userName = getUserName()

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

  // 設定画面を表示
  if (showSettings) {
    return (
      <Settings
        onClose={() => setShowSettings(false)}
        monthlyBudget={monthlyBudgetSetting}
        onBudgetChange={(newBudget) => {
          setMonthlyBudgetSetting(newBudget)
          setShowSettings(false)
        }}
      />
    )
  }

  // キャッシュフロー画面を表示
  if (showCashflow) {
    return (
      <Cashflow
        onClose={() => setShowCashflow(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              KAKEIBO
            </h1>
            <p className="text-xs text-gray-500 mt-2">
              ユーザー：{userName}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCashflow(true)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              キャッシュフロー
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              設定
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* 予算設定を促すメッセージ */}
        {monthlyBudgetSetting <= 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-800 leading-relaxed">
                  予算を設定すると、日々の支出を管理しやすくなります。
                  <br />
                  右上の設定ボタンから予算を設定しましょう。
                </p>
              </div>
            </div>
          </div>
        )}

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

        {/* 今日の予実と今月の予実（横並び） */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* 今日の予実 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-3 text-gray-700">今日の予実</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">予算</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(todayBudget)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">実績</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(todayActual)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">差額</p>
              <p className={`text-base font-bold ${getDifferenceColor(getDifference(todayBudget, todayActual))}`}>
                {formatCurrency(getDifference(todayBudget, todayActual))}
              </p>
            </div>
          </div>

          {/* 今月の予実 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-3 text-gray-700">今月の予実（今日まで）</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">累積予算</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(monthlyBudget)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">累積実績</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(monthlyActual)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">差額</p>
              <p className={`text-base font-bold ${getDifferenceColor(getDifference(monthlyBudget, monthlyActual))}`}>
                {formatCurrency(getDifference(monthlyBudget, monthlyActual))}
              </p>
            </div>
          </div>
        </div>

        {/* 日毎の予実一覧 */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">日ごとの予実一覧表</h2>
          <div className="mb-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableMonths.map((month) => (
                <button
                  key={month.value}
                  onClick={() => setSelectedMonth(month.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedMonth === month.value
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {month.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-semibold text-gray-700 bg-white">日</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-700 bg-white">曜</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700 bg-white">予算</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700 bg-white">実績</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700 bg-white">差分</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day) => (
                  <tr
                    key={day.date}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      day.weekday === 0 ? 'bg-red-50' : day.weekday === 6 ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-1.5 px-2 text-gray-800">{day.day}</td>
                    <td className="py-1.5 px-2 text-gray-600">{day.weekdayName}</td>
                    <td className="py-1.5 px-2 text-right text-gray-800">
                      {formatCurrency(day.budget).replace('¥', '¥')}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-800">
                      {day.actual > 0 ? formatCurrency(day.actual).replace('¥', '¥') : '-'}
                    </td>
                    <td className={`py-1.5 px-2 text-right font-medium ${getDifferenceColor(day.difference)}`}>
                      {day.actual > 0 || day.difference !== -day.budget
                        ? formatCurrency(day.difference).replace('¥', day.difference >= 0 ? '+¥' : '¥')
                        : '-'}
                    </td>
                  </tr>
                ))}
                {/* 合計行 */}
                <tr className="sticky bottom-0 border-t-2 border-gray-300 bg-gray-100 font-semibold z-10">
                  <td className="py-2 px-2 text-gray-800 bg-gray-100" colSpan="2">合計</td>
                  <td className="py-2 px-2 text-right text-gray-800 bg-gray-100">
                    {formatCurrency(totalBudget).replace('¥', '¥')}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-800 bg-gray-100">
                    {formatCurrency(totalActual).replace('¥', '¥')}
                  </td>
                  <td className={`py-2 px-2 text-right bg-gray-100 ${getDifferenceColor(totalDifference)}`}>
                    {formatCurrency(totalDifference).replace('¥', totalDifference >= 0 ? '+¥' : '¥')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 期間進捗 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">期間進捗</h2>
          
          {/* 今日までの期間進捗 */}
          <div className="mb-4">
            <div className="bg-gray-800 text-white px-4 py-2 rounded-t-xl font-semibold text-sm">
              今日までの期間進捗
            </div>
            <div className="border border-gray-200 rounded-b-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">期間</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">状況</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">期間使用率</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">残金</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="py-2 px-4 text-gray-800">今月</td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        monthlyActual > monthlyBudget
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {monthlyActual > monthlyBudget ? 'ビハインド' : '予算内'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-gray-800">
                      {monthlyBudget > 0 ? ((monthlyActual / monthlyBudget) * 100).toFixed(0) : 0}%
                    </td>
                    <td className={`py-2 px-4 text-right font-medium ${
                      monthlyBudget - monthlyActual < 0 ? 'text-red-600' : 'text-gray-800'
                    }`}>
                      {formatCurrency(monthlyBudget - monthlyActual)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 週次期間進捗 */}
          <div>
            <div className="bg-gray-600 text-white px-4 py-2 rounded-t-xl font-semibold text-sm">
              週次期間進捗
            </div>
            <div className="border border-gray-200 rounded-b-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">期間</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">状況</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">期間使用率</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">残金</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map((week, index) => (
                    <tr
                      key={week.period}
                      className={`border-t border-gray-200 ${
                        index === weeklyData.length - 1 ? '' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-gray-800">{week.period}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          week.status === 'ビハインド'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {week.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right text-gray-800">
                        {week.progressRate.toFixed(0)}%
                      </td>
                      <td className={`py-2 px-4 text-right font-medium ${
                        week.remaining < 0 ? 'text-red-600' : 'text-gray-800'
                      }`}>
                        {formatCurrency(week.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 取引履歴 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3 text-gray-700">取引履歴</h2>
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">取引履歴がありません</p>
          ) : (
            <>
              {/* 最近5つ */}
              <div className="space-y-1.5 mb-3">
                {transactions.slice(0, 5).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-800">
                        {formatCurrency(parseFloat(transaction.amount))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.date).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs font-medium"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 過去のデータを見るボタン */}
              {transactions.length > 5 && (
                <button
                  onClick={() => {
                    setShowOldTransactions(!showOldTransactions)
                    if (!showOldTransactions) {
                      // 展開時は現在の月を選択
                      const today = new Date()
                      setSelectedHistoryMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
                    }
                  }}
                  className="w-full py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium mb-3"
                >
                  {showOldTransactions ? '過去のデータを閉じる' : '過去のデータを見る'}
                </button>
              )}

              {/* 過去のデータ（月選択で表示） */}
              {showOldTransactions && transactions.length > 5 && (() => {
                const [selectedYear, selectedMonthNum] = selectedHistoryMonth.split('-').map(Number)
                
                // 選択された月の取引履歴をフィルタリング（新しい順）
                const monthTransactions = transactions
                  .filter(t => {
                    const tDate = new Date(t.date)
                    return tDate.getFullYear() === selectedYear && tDate.getMonth() + 1 === selectedMonthNum
                  })
                  .sort((a, b) => new Date(b.date) - new Date(a.date)) // 新しい順

                // 月の合計額を計算
                const monthTotal = monthTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)

                // 取引履歴からデータがある月を抽出
                const monthsWithData = new Set()
                transactions.forEach(t => {
                  const tDate = new Date(t.date)
                  const year = tDate.getFullYear()
                  const month = tDate.getMonth() + 1
                  monthsWithData.add(`${year}-${String(month).padStart(2, '0')}`)
                })

                // 当月と前月を計算
                const today = new Date()
                const currentYear = today.getFullYear()
                const currentMonth = today.getMonth() + 1
                const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
                
                const prevMonthDate = new Date(currentYear, currentMonth - 2, 1)
                const prevYear = prevMonthDate.getFullYear()
                const prevMonth = prevMonthDate.getMonth() + 1
                const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`

                // 基本タブ（当月と前月、データがあるもののみ）
                const baseMonths = []
                if (monthsWithData.has(currentMonthKey)) {
                  baseMonths.push({
                    value: currentMonthKey,
                    label: `${currentYear}年${currentMonth}月`,
                  })
                }
                if (monthsWithData.has(prevMonthKey)) {
                  baseMonths.push({
                    value: prevMonthKey,
                    label: `${prevYear}年${prevMonth}月`,
                  })
                }

                // それより過去のデータがある月を抽出
                const olderMonths = []
                monthsWithData.forEach(monthKey => {
                  if (monthKey !== currentMonthKey && monthKey !== prevMonthKey) {
                    const [year, month] = monthKey.split('-').map(Number)
                    olderMonths.push({
                      value: monthKey,
                      label: `${year}年${month}月`,
                    })
                  }
                })
                // 新しい順にソート
                olderMonths.sort((a, b) => b.value.localeCompare(a.value))

                // 過去のデータがあるかどうか
                const hasOlderData = olderMonths.length > 0

                return (
                  <div className="border-t border-gray-200 pt-3">
                    {/* 月選択タブ */}
                    <div className="mb-3">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {/* 基本タブ（当月と前月） */}
                        {baseMonths.map((month) => (
                          <button
                            key={month.value}
                            onClick={() => setSelectedHistoryMonth(month.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                              selectedHistoryMonth === month.value
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {month.label}
                          </button>
                        ))}
                        {/* 過去のデータがある場合、展開されたら表示 */}
                        {showOlderMonths && olderMonths.map((month) => (
                          <button
                            key={month.value}
                            onClick={() => setSelectedHistoryMonth(month.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                              selectedHistoryMonth === month.value
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {month.label}
                          </button>
                        ))}
                      </div>
                      {/* 「さらに過去のデータを見る」ボタン */}
                      {hasOlderData && (
                        <button
                          onClick={() => setShowOlderMonths(!showOlderMonths)}
                          className="mt-2 w-full py-1.5 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium"
                        >
                          {showOlderMonths ? '過去のデータを閉じる' : 'さらに過去のデータを見る'}
                        </button>
                      )}
                    </div>

                    {/* 選択された月の取引履歴 */}
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      {monthTransactions.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">この月の取引履歴がありません</p>
                      ) : (
                        <div className="space-y-1.5">
                          {monthTransactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-gray-800">
                                  {formatCurrency(parseFloat(transaction.amount))}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(transaction.date).toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'short',
                                  })}
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleEdit(transaction)}
                                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs font-medium"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDelete(transaction.id)}
                                  className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 月の合計額（固定） */}
                    {monthTransactions.length > 0 && (
                      <div className="sticky bottom-0 border-t-2 border-gray-300 bg-gray-100 mt-2 rounded-lg z-10">
                        <div className="flex items-center justify-between py-2 px-2">
                          <span className="text-xs font-semibold text-gray-700">合計</span>
                          <span className="text-xs font-bold text-gray-800">
                            {formatCurrency(monthTotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

