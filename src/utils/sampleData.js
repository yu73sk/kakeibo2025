/**
 * サンプルデータ生成ユーティリティ
 */

import { calculateDailyBudget } from './budgetCalculation'

// サンプルデータの月次予算（20万円）
const SAMPLE_MONTHLY_BUDGET = 200000

/**
 * サンプルデータの日毎の予実データを生成
 * 実績合計: 22万円（予算の110%）
 * マイナス日（予算未満）: 80%
 * プラス日（予算超過）: 20%
 */
export function generateSampleDailyData() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  
  const dailyData = []
  const totalBudget = 220000 // 実績合計（予算の110%）
  
  // 各日の予算を計算
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const budget = calculateDailyBudget(date, SAMPLE_MONTHLY_BUDGET)
    dailyData.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      weekday: date.getDay(),
      weekdayName: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()],
      budget,
      actual: 0, // 後で設定
      difference: 0, // 後で設定
    })
  }
  
  // マイナス日とプラス日を決定（80%:20%）
  const minusDaysCount = Math.floor(daysInMonth * 0.8)
  const plusDaysCount = daysInMonth - minusDaysCount
  
  // すべての日をシャッフルしてランダムに選択
  const dayIndices = Array.from({ length: daysInMonth }, (_, i) => i)
  for (let i = dayIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dayIndices[i], dayIndices[j]] = [dayIndices[j], dayIndices[i]]
  }
  
  // マイナス日の実績を設定（予算の80-90%）
  const minusDayIndices = dayIndices.slice(0, minusDaysCount)
  minusDayIndices.forEach(dayIndex => {
    const ratio = 0.8 + Math.random() * 0.1 // 80-90%
    dailyData[dayIndex].actual = dailyData[dayIndex].budget * ratio
    dailyData[dayIndex].difference = dailyData[dayIndex].actual - dailyData[dayIndex].budget
  })
  
  // プラス日の実績を設定（予算の150-200%）
  const plusDayIndices = dayIndices.slice(minusDaysCount)
  plusDayIndices.forEach(dayIndex => {
    const ratio = 1.5 + Math.random() * 0.5 // 150-200%
    dailyData[dayIndex].actual = dailyData[dayIndex].budget * ratio
    dailyData[dayIndex].difference = dailyData[dayIndex].actual - dailyData[dayIndex].budget
  })
  
  // 実績の合計を計算
  const currentTotal = dailyData.reduce((sum, day) => sum + day.actual, 0)
  
  // 実績合計を22万円に調整
  const adjustmentRatio = totalBudget / currentTotal
  dailyData.forEach(day => {
    day.actual = day.actual * adjustmentRatio
    day.difference = day.actual - day.budget
  })
  
  return dailyData
}

/**
 * サンプルデータの取引履歴を生成（日毎の予実一覧表の実績に基づく）
 */
export function generateSampleTransactions() {
  const dailyData = generateSampleDailyData()
  const transactions = []
  
  // 実績がある日から5件を選択
  const daysWithActual = dailyData.filter(day => day.actual > 0)
  const selectedDays = daysWithActual.slice(0, 5)
  
  selectedDays.forEach((day, index) => {
    transactions.push({
      id: `sample-${index}`,
      date: day.date,
      amount: Math.round(day.actual),
      created_at: new Date(day.date).toISOString(),
    })
  })
  
  // 日付の新しい順にソート
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
  
  return transactions
}

/**
 * サンプルデータの今日の予実を計算
 */
export function getSampleTodayData() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dailyData = generateSampleDailyData()
  
  const todayData = dailyData.find(day => day.date === todayStr)
  if (!todayData) {
    return { budget: 0, actual: 0 }
  }
  
  return {
    budget: todayData.budget,
    actual: todayData.actual,
  }
}

/**
 * サンプルデータの今月の累積予実を計算
 */
export function getSampleMonthlyData() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dailyData = generateSampleDailyData()
  
  let budget = 0
  let actual = 0
  
  dailyData.forEach(day => {
    if (day.date <= todayStr) {
      budget += day.budget
      actual += day.actual
    }
  })
  
  return { budget, actual }
}

/**
 * サンプルデータの週次予実進捗を計算
 */
export function getSampleWeeklyData() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const todayStr = today.toISOString().split('T')[0]
  const daysInMonth = new Date(year, month, 0).getDate()
  
  const dailyData = generateSampleDailyData()
  
  // 週の定義
  const weeks = [
    { start: 1, end: 7, label: '1W' },
    { start: 8, end: 14, label: '2W' },
    { start: 15, end: 21, label: '3W' },
    { start: 22, end: 28, label: '4W' },
    { start: 29, end: daysInMonth, label: '5W' },
  ]
  
  const weeklyData = []
  
  weeks.forEach((week, weekIndex) => {
    let weekBudget = 0
    let weekActual = 0
    
    // 累積計算（1Wは1Wのみ、2Wは1W+2W、など）
    for (let w = 0; w <= weekIndex; w++) {
      const currentWeek = weeks[w]
      const weekEnd = Math.min(currentWeek.end, daysInMonth)
      
      for (let d = currentWeek.start; d <= weekEnd; d++) {
        const dayData = dailyData.find(dd => dd.day === d)
        if (dayData) {
          const dayDateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          if (dayDateStr <= todayStr) {
            weekBudget += dayData.budget
            weekActual += dayData.actual
          }
        }
      }
    }
    
    const usageRate = weekBudget > 0 ? (weekActual / weekBudget) * 100 : 0
    const remaining = weekBudget - weekActual
    const isBehind = weekActual > weekBudget
    
    weeklyData.push({
      period: week.label,
      status: isBehind ? 'ビハインド' : '予算内',
      usageRate: usageRate.toFixed(0),
      remaining: remaining,
      isBehind,
    })
  })
  
  return weeklyData
}

/**
 * サンプルデータの月次予算を取得
 */
export function getSampleMonthlyBudget() {
  return SAMPLE_MONTHLY_BUDGET
}

