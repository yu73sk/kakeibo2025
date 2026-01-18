import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// プリセット項目
const PRESET_EXPENSE_CATEGORIES = ['家賃', 'ローン', '楽天', 'PayPay', 'ANA', 'Amazon']
const PRESET_INCOME_CATEGORIES = ['給与']

function Cashflow({ onClose }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [expenseItems, setExpenseItems] = useState([])
  const [incomeItems, setIncomeItems] = useState([])
  const [savingsAmount, setSavingsAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState([])

  // 利用可能な年月のリストを生成
  const getAvailableMonths = () => {
    const months = []
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1

    // 過去12ヶ月から未来3ヶ月まで
    for (let i = 12; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i - 1, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      months.push({ year, month, label: `${year}年${month}月` })
    }

    for (let i = 1; i <= 3; i++) {
      const date = new Date(currentYear, currentMonth + i - 1, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      months.push({ year, month, label: `${year}年${month}月` })
    }

    return months
  }

  // 項目をソート（固定費を上に）
  const sortItems = (items) => {
    return [...items].sort((a, b) => {
      // 固定費を上に
      if (a.isFixed && !b.isFixed) return -1
      if (!a.isFixed && b.isFixed) return 1
      // 固定費同士は金額の高い順
      if (a.isFixed && b.isFixed) {
        const amountA = parseFloat(a.amount) || 0
        const amountB = parseFloat(b.amount) || 0
        return amountB - amountA
      }
      // 非固定費同士は項目名順
      return (a.name || '').localeCompare(b.name || '', 'ja')
    })
  }

  // データを読み込む
  const loadCashflow = useCallback(async (year, month) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('cashflow')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', year)
        .eq('month', month)
        .order('type', { ascending: false })
        .order('category_name', { ascending: true })

      if (error) throw error

      const expenses = (data || []).filter(item => item.type === 'expense')
      const incomes = (data || []).filter(item => item.type === 'income')

      // 貯金データを読み込む
      const { data: savingsData, error: savingsError } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (savingsError && savingsError.code !== 'PGRST116') {
        console.error('貯金読み込みエラー:', savingsError)
      } else if (savingsData) {
        setSavingsAmount(parseFloat(savingsData.amount) || 0)
      } else {
        setSavingsAmount(0)
      }

      // データがない場合、前月から引き継ぐ
      if (expenses.length === 0 && incomes.length === 0) {
        await loadPreviousMonthData(year, month)
      } else {
        const expenseItemsData = expenses.map(item => ({
          id: item.id,
          name: item.category_name,
          amount: parseFloat(item.amount) || 0,
          isFixed: item.is_fixed || false,
        }))
        const incomeItemsData = incomes.map(item => ({
          id: item.id,
          name: item.category_name,
          amount: parseFloat(item.amount) || 0,
          isFixed: item.is_fixed || false,
        }))
        // 固定費を上にソート
        setExpenseItems(sortItems(expenseItemsData))
        setIncomeItems(sortItems(incomeItemsData))
      }
    } catch (error) {
      console.error('キャッシュフロー読み込みエラー:', error)
    }
  }, [])

  // 前月のデータを引き継ぐ
  const loadPreviousMonthData = async (year, month) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 前月を計算
      const prevDate = new Date(year, month - 2, 1)
      const prevYear = prevDate.getFullYear()
      const prevMonth = prevDate.getMonth() + 1

      // 前月のデータを取得
      const { data: prevData, error } = await supabase
        .from('cashflow')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', prevYear)
        .eq('month', prevMonth)

      if (error) throw error

      if (prevData && prevData.length > 0) {
        const prevExpenses = prevData.filter(item => item.type === 'expense')
        const prevIncomes = prevData.filter(item => item.type === 'income')

        // 固定費フラグがついている項目は金額も引き継ぐ
        const newExpenses = prevExpenses.map(item => ({
          name: item.category_name,
          amount: item.is_fixed ? (parseFloat(item.amount) || 0) : 0,
          isFixed: item.is_fixed || false,
        }))

        const newIncomes = prevIncomes.map(item => ({
          name: item.category_name,
          amount: item.is_fixed ? (parseFloat(item.amount) || 0) : 0,
          isFixed: item.is_fixed || false,
        }))

        // 固定費を上にソート
        setExpenseItems(sortItems(newExpenses))
        setIncomeItems(sortItems(newIncomes))

        // 引き継いだデータを保存
        await saveItems(newExpenses, newIncomes, year, month)
      } else {
        // 前月のデータもない場合、空の配列を設定（初期値は項目なし）
        setExpenseItems([])
        setIncomeItems([])
      }
    } catch (error) {
      console.error('前月データ読み込みエラー:', error)
      // エラーの場合、空の配列を設定（初期値は項目なし）
      setExpenseItems([])
      setIncomeItems([])
    }
  }

  // 項目を保存
  const saveItems = useCallback(async (expenses, incomes, year, month) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setLoading(true)

      // 既存データを削除
      await supabase
        .from('cashflow')
        .delete()
        .eq('user_id', session.user.id)
        .eq('year', year)
        .eq('month', month)

      // 新しいデータを挿入
      const itemsToInsert = [
        ...expenses.map(item => ({
          user_id: session.user.id,
          year,
          month,
          type: 'expense',
          category_name: item.name,
          amount: item.amount || 0,
          is_fixed: item.isFixed || false,
        })),
        ...incomes.map(item => ({
          user_id: session.user.id,
          year,
          month,
          type: 'income',
          category_name: item.name,
          amount: item.amount || 0,
          is_fixed: item.isFixed || false,
        })),
      ]

      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from('cashflow')
          .insert(itemsToInsert)

        if (error) throw error
      }
    } catch (error) {
      console.error('保存エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 貯金を保存
  const saveSavings = useCallback(async (amount, year, month) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setLoading(true)

      // 既存データを確認
      const { data: existingData } = await supabase
        .from('savings')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existingData) {
        // 更新
        const { error } = await supabase
          .from('savings')
          .update({
            amount: amount || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingData.id)

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await supabase
          .from('savings')
          .insert({
            user_id: session.user.id,
            year,
            month,
            amount: amount || 0,
          })

        if (error) throw error
      }
    } catch (error) {
      console.error('貯金保存エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 1月〜12月のグラフデータを読み込む
  const loadChartData = useCallback(async (year) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 1月〜12月のデータを取得
      const { data, error } = await supabase
        .from('cashflow')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', year)
        .order('month', { ascending: true })

      if (error) throw error

      // 月ごとにデータを集計
      const monthlyData = {}
      for (let month = 1; month <= 12; month++) {
        monthlyData[month] = { income: 0, expense: 0 }
      }

      if (data) {
        data.forEach(item => {
          const month = item.month
          if (item.type === 'income') {
            monthlyData[month].income += parseFloat(item.amount) || 0
          } else if (item.type === 'expense') {
            monthlyData[month].expense += parseFloat(item.amount) || 0
          }
        })
      }

      // グラフ用データを生成（データがある月のみ）
      const chartDataArray = []
      for (let month = 1; month <= 12; month++) {
        const income = monthlyData[month].income
        const expense = monthlyData[month].expense
        const balance = income - expense

        // データがある月のみ追加（収入または支出が0より大きい）
        if (income > 0 || expense > 0) {
          chartDataArray.push({
            month: `${month}月`,
            income: income,
            expense: -expense, // 支出は負の値で下方向に表示（0を起点）
            balance: balance,
          })
        }
      }

      setChartData(chartDataArray)
    } catch (error) {
      console.error('グラフデータ読み込みエラー:', error)
    }
  }, [])

  // 月が変更されたときにデータを読み込む
  useEffect(() => {
    loadCashflow(selectedYear, selectedMonth)
    loadChartData(selectedYear)
  }, [selectedYear, selectedMonth, loadCashflow, loadChartData])

  // 自動保存（デバウンス付き）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (expenseItems.length > 0 || incomeItems.length > 0) {
        saveItems(expenseItems, incomeItems, selectedYear, selectedMonth)
      }
      // 貯金も自動保存
      saveSavings(savingsAmount, selectedYear, selectedMonth)
    }, 1000) // 1秒後に自動保存

    return () => clearTimeout(timer)
  }, [expenseItems, incomeItems, savingsAmount, selectedYear, selectedMonth, saveSavings])

  // 項目を追加
  const addItem = (type) => {
    const newItem = { name: '', amount: 0, isFixed: false }
    if (type === 'expense') {
      setExpenseItems([...expenseItems, newItem])
    } else {
      setIncomeItems([...incomeItems, newItem])
    }
  }

  // 項目を削除
  const removeItem = (type, index) => {
    if (type === 'expense') {
      setExpenseItems(expenseItems.filter((_, i) => i !== index))
    } else {
      setIncomeItems(incomeItems.filter((_, i) => i !== index))
    }
  }

  // 項目を更新
  const updateItem = (type, index, field, value) => {
    if (type === 'expense') {
      const updated = [...expenseItems]
      updated[index] = { ...updated[index], [field]: value }
      // 固定費フラグが変更された場合、ソートを実行
      const sorted = field === 'isFixed' ? sortItems(updated) : updated
      setExpenseItems(sorted)
    } else {
      const updated = [...incomeItems]
      updated[index] = { ...updated[index], [field]: value }
      // 固定費フラグが変更された場合、ソートを実行
      const sorted = field === 'isFixed' ? sortItems(updated) : updated
      setIncomeItems(sorted)
    }
  }

  // 合計を計算
  const totalExpense = expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const totalIncome = incomeItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const netCashflow = totalIncome - totalExpense

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const availableMonths = getAvailableMonths()

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">キャッシュフロー</h1>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            閉じる
          </button>
        </div>

        {/* 月選択 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <label htmlFor="monthSelect" className="block text-sm font-medium text-gray-700 mb-2">
            月を選択
          </label>
          <select
            id="monthSelect"
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number)
              setSelectedYear(year)
              setSelectedMonth(month)
            }}
            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            {availableMonths.map((m) => (
              <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 単月収支 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            単月収支 {formatCurrency(netCashflow)}
          </h2>

          {/* 支出合計 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">支出合計</h3>
              <span className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</span>
            </div>
            <div className="space-y-1.5">
              {expenseItems.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 py-1.5 px-2 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem('expense', index, 'name', e.target.value)}
                    placeholder="項目名"
                    className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-xs"
                  />
                  <button
                    onClick={() => updateItem('expense', index, 'isFixed', !item.isFixed)}
                    className={`px-1.5 py-0.5 text-xs rounded border ${
                      item.isFixed
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                    }`}
                    title="固定費"
                  >
                    固定費
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.amount || ''}
                    onChange={(e) => updateItem('expense', index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-xs text-right"
                    min="0"
                    step="1"
                  />
                  <button
                    onClick={() => removeItem('expense', index)}
                    className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                onClick={() => addItem('expense')}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                + 支出項目を追加
              </button>
            </div>
          </div>

          {/* 収入合計 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">収入合計</h3>
              <span className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</span>
            </div>
            <div className="space-y-1.5">
              {incomeItems.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 py-1.5 px-2 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem('income', index, 'name', e.target.value)}
                    placeholder="項目名"
                    className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-xs"
                  />
                  <button
                    onClick={() => updateItem('income', index, 'isFixed', !item.isFixed)}
                    className={`px-1.5 py-0.5 text-xs rounded border ${
                      item.isFixed
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                    }`}
                    title="固定費"
                  >
                    固定費
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.amount || ''}
                    onChange={(e) => updateItem('income', index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-xs text-right"
                    min="0"
                    step="1"
                  />
                  <button
                    onClick={() => removeItem('income', index)}
                    className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                onClick={() => addItem('income')}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                + 収入項目を追加
              </button>
            </div>
          </div>
        </div>

        {/* 貯金 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">貯金</h2>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 py-1.5 px-2 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <span className="text-xs font-semibold text-gray-800">貯金</span>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={savingsAmount || ''}
                onChange={(e) => setSavingsAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-xs text-right"
                min="0"
                step="1"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center text-sm text-gray-500 mt-4">保存中...</div>
        )}

        {/* 月ごとの収支推移グラフ */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">月ごとの収支推移</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                barCategoryGap={0}
                barGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  stroke="#9ca3af"
                  tickFormatter={(value) => {
                    if (value === 0) return '0'
                    return new Intl.NumberFormat('ja-JP', {
                      style: 'currency',
                      currency: 'JPY',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(Math.abs(value))
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                          <p className="text-sm font-semibold text-gray-700 mb-1">{data.month}</p>
                          <p className="text-xs text-green-600">
                            収入: {formatCurrency(data.income)}
                          </p>
                          <p className="text-xs text-red-600">
                            支出: {formatCurrency(-data.expense)}
                          </p>
                          <p className="text-xs font-semibold text-gray-800 mt-1">
                            収支: {formatCurrency(data.balance)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="line"
                />
                <Bar
                  dataKey="income"
                  name="収入"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="expense"
                  name="支出"
                  fill="#ef4444"
                  radius={[0, 0, 4, 4]}
                  barSize={20}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="収支"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#9ca3af' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default Cashflow

