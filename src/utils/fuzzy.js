// ── Levenshtein distance ─────────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function normalize(s) {
  return s.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
}

function tokenize(s) {
  return normalize(s).split(' ').filter(Boolean)
}

// ── Full-string similarity (original method) ─────────────────────────────────
export function strSimilarity(a, b) {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1
  const max = Math.max(na.length, nb.length)
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max
}

// ── Word-level similarity ─────────────────────────────────────────────────────
// Handles partial names: "Rajan" vs "Rajan Malhotra", "Harkirta" vs "Harkirat Singh"
// Returns { score, isSingleWordShort } so the caller can apply the safety cap
function wordSimilarity(a, b) {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length === 0 || tokensB.length === 0) return { score: 0, isSingleWordShort: false }

  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB
  const longer  = tokensA.length <= tokensB.length ? tokensB : tokensA

  let totalScore = 0
  for (const word of shorter) {
    let best = 0
    for (const candidate of longer) {
      const s = strSimilarity(word, candidate)
      if (s > best) best = s
    }
    totalScore += best
  }
  const score = totalScore / shorter.length

  return { score, isSingleWordShort: shorter.length === 1 }
}

// ── Combined name match: best of full-string vs word-level ───────────────────
// isExact = the two names are LITERALLY identical (used to exclude cases
// already caught by the DB's exact-match check). This is separate from the
// combined score, because word-level matching can hit 100% on a PARTIAL
// name (e.g. "Rajan" fully matches inside "Rajan Malhotra") even though the
// two strings are clearly not the same — that case must still be flagged.
function nameMatch(a, b) {
  const isExact = normalize(a) === normalize(b)
  const full = strSimilarity(a, b)
  const word = wordSimilarity(a, b)
  const best = word.score > full
    ? { score: word.score, isSingleWordShort: word.isSingleWordShort }
    : { score: full, isSingleWordShort: word.isSingleWordShort }
  return { ...best, isExact }
}

// ── TIER 1: Strong duplicate → BLOCK ─────────────────────────────────────────
// Client match ≥80% + Project match ≥65% + Same architect
// Excludes cases where client match came from a single-word short name —
// those are capped to the weak/warn tier only (see findWeakDuplicates)
export function findStrongDuplicates(clientName, projectName, architectId, inquiries, excludeId = null) {
  if (!clientName.trim() || !projectName.trim() || !architectId) return []
  return inquiries
    .filter(i => {
      if (excludeId && i.id === excludeId) return false
      const client  = nameMatch(clientName, i.client_name)
      const project = strSimilarity(projectName, i.project_name)
      const sameArch = i.architect_id === architectId

      if (client.isExact) return false                  // exact match — handled by DB check
      if (client.isSingleWordShort) return false        // safety cap — never hard-block on a single-word name

      return client.score >= 0.80 && project >= 0.65 && sameArch
    })
    .sort((a, b) => nameMatch(clientName, b.client_name).score - nameMatch(clientName, a.client_name).score)
    .slice(0, 3)
}

// ── TIER 2: Weak duplicate → YELLOW WARN + allow ─────────────────────────────
// Catches: lower-confidence full/multi-word matches, AND single-word short
// names (e.g. "Rajan" vs "Rajan Malhotra") regardless of how high their score is —
// these are always capped here, never escalated to a hard block
export function findWeakDuplicates(clientName, projectName, architectId, inquiries, excludeId = null) {
  if (!clientName.trim() || !projectName.trim()) return []
  return inquiries
    .filter(i => {
      if (excludeId && i.id === excludeId) return false
      const client  = nameMatch(clientName, i.client_name)
      const project = strSimilarity(projectName, i.project_name)
      const sameArch = i.architect_id === architectId

      if (client.isExact) return false

      // Single-word short name: catches spelling mistakes on short names too,
      // always weak tier only (never escalates to hard block)
      if (client.isSingleWordShort) {
        return client.score >= 0.70 && project >= 0.40
      }

      // Otherwise: normal weak threshold, but exclude anything already caught by strong tier
      const meetsWeak     = client.score >= 0.60 && project >= 0.50
      const alreadyStrong = client.score >= 0.80 && project >= 0.65 && sameArch
      return meetsWeak && !alreadyStrong
    })
    .sort((a, b) => nameMatch(clientName, b.client_name).score - nameMatch(clientName, a.client_name).score)
    .slice(0, 3)
}
