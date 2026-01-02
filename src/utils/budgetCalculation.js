/**
 * 予算按分計算ユーティリティ
 */

// 曜日別の比率（%）
const WEEKDAY_RATIOS = {
  0: 19, // 日曜日
  1: 5,  // 月曜日
  2: 5,  // 火曜日
  3: 5,  // 水曜日
  4: 5,  // 木曜日
  5: 19, // 金曜日
  6: 42, // 土曜日
}

const MONTHLY_BUDGET = 180000 // 月間予算（円）

/**
 * 指定された年月の各曜日の日数を取得
 */
export function getWeekdayCounts(year, month) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  
  // その月の日数を取得
  const daysInMonth = new Date(year, month, 0).getDate()
  
  // 各日の曜日をカウント
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const weekday = date.getDay()
    counts[weekday]++
  }
  
  return counts
}

/**
 * 指定された年月の1%あたりの単価を計算
 */
export function calculateUnitPrice(year, month) {
  const weekdayCounts = getWeekdayCounts(year, month)
  
  // 各曜日の比率 × 日数の合計を計算
  let totalWeightedDays = 0
  for (let weekday = 0; weekday < 7; weekday++) {
    totalWeightedDays += (WEEKDAY_RATIOS[weekday] / 100) * weekdayCounts[weekday]
  }
  
  // 1%あたりの単価 = 月間予算 ÷ 合計
  const unitPrice = MONTHLY_BUDGET / totalWeightedDays
  
  return unitPrice
}

/**
 * 指定された日の日次予算を計算
 */
export function calculateDailyBudget(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const weekday = date.getDay()
  
  const unitPrice = calculateUnitPrice(year, month)
  const ratio = WEEKDAY_RATIOS[weekday] / 100
  
  return unitPrice * ratio
}

/**
 * 今日までの累積予算を計算
 */
export function calculateCumulativeBudget(year, month, day) {
  let total = 0
  
  for (let d = 1; d <= day; d++) {
    const date = new Date(year, month - 1, d)
    total += calculateDailyBudget(date)
  }
  
  return total
}

/**
 * 今月の累積予算を計算（月初から今日まで）
 */
export function calculateMonthlyCumulativeBudget() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  
  return calculateCumulativeBudget(year, month, day)
}

/**
 * 今日の予算を取得
 */
export function getTodayBudget() {
  const today = new Date()
  return calculateDailyBudget(today)
}

/**
 * 今月の総予算を計算
 */
export function calculateMonthlyTotalBudget() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  
  return calculateCumulativeBudget(year, month, daysInMonth)
}

