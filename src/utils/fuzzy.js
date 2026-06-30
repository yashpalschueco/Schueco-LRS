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

// ── Full-string similarity ────────────────────────────────────────────────────
export function strSimilarity(a, b) {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1
  const max = Math.max(na.length, nb.length)
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max
}

// ── Word-level similarity ─────────────────────────────────────────────────────
// Handles partial names: "Rajan" vs "Rajan Malhotra", "Harkirta" vs "Harkirat Singh"
function wordSimilarity(a, b) {
  const tokensA = tokenize(a), tokensB = tokenize(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB
  const longer  = tokensA.length <= tokensB.length ? tokensB : tokensA
  let total = 0
  for (const word of shorter) {
    let best = 0
    for (const candidate of longer) {
      const s = strSimilarity(word, candidate)
      if (s > best) best = s
    }
    total += best
  }
  return total / shorter.length
}

// ── Combined name match: best of full-string vs word-level ───────────────────
function nameScore(a, b) {
  return Math.max(strSimilarity(a, b), wordSimilarity(a, b))
}

// ── Client name matching — the single source of truth for duplicate checks ──
// Compares ONLY the client name (deliberately ignores project name, since
// historical entries often carry a generic placeholder project name and
// would never match on that field — this was the root cause of real
// duplicates slipping through undetected).
//
// Returns every existing inquiry whose client name is a "balanced" match
// (≥70% similarity, word-aware so partial/short names are caught too),
// excluding entries that are a literal exact match (those are caught
// separately by the DB's exact-match check).
export function findClientMatches(clientName, inquiries, excludeId = null, threshold = 0.70) {
  if (!clientName.trim()) return []
  return inquiries
    .filter(i => {
      if (excludeId && i.id === excludeId) return false
      const isExact = normalize(clientName) === normalize(i.client_name)
      if (isExact) return false
      return nameScore(clientName, i.client_name) >= threshold
    })
    .sort((a, b) => nameScore(clientName, b.client_name) - nameScore(clientName, a.client_name))
    .slice(0, 5)
}
