// Shared month options utility — imported by NewInquiry and EditInquiry
// Kept in one place to avoid duplicate module-level declarations that
// conflict with the react/jsx-runtime import during Vite minification.

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = -12; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`)
  }
  return options
}
