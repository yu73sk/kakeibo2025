import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// プリセット項目
const PRESET_EXPENSE_CATEGORIES = ['家賃', 'ローン', '楽天', 'PayPay', 'ANA', 'Amazon']
const PRESET_INCOME_CATEGORIES = ['給与']

function Cashflow({ onClose }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [expenseItems, setExpenseItems] = useState([])
  const [incomeItems, setIncomeItems] = useState([])
  const [loading, setLoading] = useState(false)

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

      // データがない場合、前月から引き継ぐ
      if (expenses.length === 0 && incomes.length === 0) {
        await loadPreviousMonthData(year, month)
      } else {
        setExpenseItems(expenses.map(item => ({
          id: item.id,
          name: item.category_name,
          amount: parseFloat(item.amount) || 0,
          isFixed: item.is_fixed || false,
        })))
        setIncomeItems(incomes.map(item => ({
          id: item.id,
          name: item.category_name,
          amount: parseFloat(item.amount) || 0,
          isFixed: item.is_fixed || false,
        })))
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

        setExpenseItems(newExpenses)
        setIncomeItems(newIncomes)

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
  const saveItems = async (expenses, incomes, year, month) => {
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
  }

  // 月が変更されたときにデータを読み込む
  useEffect(() => {
    loadCashflow(selectedYear, selectedMonth)
  }, [selectedYear, selectedMonth, loadCashflow])

  // 自動保存（デバウンス付き）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (expenseItems.length > 0 || incomeItems.length > 0) {
        saveItems(expenseItems, incomeItems, selectedYear, selectedMonth)
      }
    }, 1000) // 1秒後に自動保存

    return () => clearTimeout(timer)
  }, [expenseItems, incomeItems, selectedYear, selectedMonth])

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
      setExpenseItems(updated)
    } else {
      const updated = [...incomeItems]
      updated[index] = { ...updated[index], [field]: value }
      setIncomeItems(updated)
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
            <div className="space-y-3">
              {expenseItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem('expense', index, 'name', e.target.value)}
                      placeholder="項目名"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
                    />
                    <button
                      onClick={() => updateItem('expense', index, 'isFixed', !item.isFixed)}
                      className={`px-2 py-1 text-xs rounded ${
                        item.isFixed
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title="固定費"
                    >
                      📌
                    </button>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.amount || ''}
                    onChange={(e) => updateItem('expense', index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm text-right"
                    min="0"
                    step="1"
                  />
                  <button
                    onClick={() => removeItem('expense', index)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
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
            <div className="space-y-3">
              {incomeItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem('income', index, 'name', e.target.value)}
                      placeholder="項目名"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
                    />
                    <button
                      onClick={() => updateItem('income', index, 'isFixed', !item.isFixed)}
                      className={`px-2 py-1 text-xs rounded ${
                        item.isFixed
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title="固定費"
                    >
                      📌
                    </button>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.amount || ''}
                    onChange={(e) => updateItem('income', index, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm text-right"
                    min="0"
                    step="1"
                  />
                  <button
                    onClick={() => removeItem('income', index)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
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

        {loading && (
          <div className="text-center text-sm text-gray-500 mt-4">保存中...</div>
        )}
      </div>
    </div>
  )
}

export default Cashflow

