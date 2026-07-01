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
  return (s || '').toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
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
// Handles partial names: "Rajan" vs "Rajan Malhotra", "Harkirta" vs "Harkirat"
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
  if (!a || !b) return 0
  return Math.max(strSimilarity(a, b), wordSimilarity(a, b))
}

// ── Client name matching ──────────────────────────────────────────────────────
// Compares the typed client name against BOTH the client_name AND project_name
// fields of every existing inquiry. This handles a known data quality issue
// where some historical entries have a project name written in the client
// column (e.g. "Malhotra Farmhouse Delhi" instead of "Rajan Malhotra").
//
// Each match result includes:
//   _matchedVia: 'client' | 'project' — which field triggered the match
//   _score: the confidence score that triggered it
//
// Threshold: 70% (balanced — catches typos and partial names without too
// much noise). Single-word entries use the same threshold since we're
// deliberately searching a wider net.
export function findClientMatches(clientName, inquiries, excludeId = null, threshold = 0.70) {
  if (!clientName.trim()) return []

  const results = []

  for (const i of inquiries) {
    if (excludeId && i.id === excludeId) continue

    // Never flag a truly identical name — caught by the DB exact-match check
    const isExact = normalize(clientName) === normalize(i.client_name)
    if (isExact) continue

    const clientScore  = nameScore(clientName, i.client_name)
    const projectScore = nameScore(clientName, i.project_name || '')

    const matchesClient  = clientScore  >= threshold
    const matchesProject = projectScore >= threshold

    if (!matchesClient && !matchesProject) continue

    // Which field gave us the stronger signal?
    const matchedVia = clientScore >= projectScore ? 'client' : 'project'
    const score      = Math.max(clientScore, projectScore)

    results.push({ ...i, _matchedVia: matchedVia, _score: score })
  }

  return results
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
}
