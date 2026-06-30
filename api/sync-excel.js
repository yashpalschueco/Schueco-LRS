// api/sync-excel.js
// Vercel serverless function — syncs new/edited inquiries to OneDrive Excel
// via Microsoft Graph API

const GRAPH = 'https://graph.microsoft.com/v1.0'

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getToken() {
  const url = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      scope:         'https://graph.microsoft.com/.default',
      grant_type:    'client_credentials',
    }).toString(),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── Graph API helper ──────────────────────────────────────────────────────────
async function graph(token, method, path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Graph ${method} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

// ── Encode OneDrive sharing URL ───────────────────────────────────────────────
function encodeShareUrl(url) {
  const b64 = Buffer.from(url).toString('base64')
    .replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-')
  return `u!${b64}`
}

// ── Build row: matches columns A–L in Excel ───────────────────────────────────
// A: Inquiry ID  B: Status  C: Project Value  D: Date  E: CPS
// F: Responsible  G: Region  H: Site Location  I: Architect
// J: Client Name  K: Meeting w/ Client  L: Legacy/New
function buildRow(inq) {
  return [[
    inq.id                        || '',
    inq.status                    || '',
    inq.project_value             || '',
    inq.created_at ? inq.created_at.split('T')[0] : '',
    inq.cps_notes                 || '',
    inq.responsible_name          || '',
    inq.region                    || '',
    inq.site_location             || '',
    inq.architect_name            || '',
    inq.client_name               || '',
    inq.meeting_with_client       || '',
    inq.legacy_new                || '',
  ]]
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Allow CORS from same origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { action, inquiry } = req.body
    if (!inquiry?.id) return res.status(400).json({ error: 'No inquiry data' })

    const SHEET = process.env.MS_SHEET_NAME || 'SB Tracker'
    const TABLE = process.env.MS_TABLE_NAME || 'InquiryData'

    const token = await getToken()

    // Get Drive + Item IDs from sharing URL
    const encoded = encodeShareUrl(process.env.MS_FILE_SHARE_URL)
    const file    = await graph(token, 'GET', `/shares/${encoded}/driveItem`)
    const driveId = file.parentReference.driveId
    const itemId  = file.id
    const base    = `/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(SHEET)}')/tables('${TABLE}')`

    if (action === 'insert') {
      // Insert new row at the TOP of the table (index 0 = first data row)
      await graph(token, 'POST', `${base}/rows/add`, {
        index:  0,
        values: buildRow(inquiry),
      })

    } else if (action === 'update') {
      // Find existing row by Inquiry ID (column A)
      const rows = await graph(token, 'GET', `${base}/rows?$top=500`)
      const idx  = (rows.value || []).findIndex(r => r.values[0][0] === inquiry.id)

      if (idx >= 0) {
        // Update all 12 columns for that row
        await graph(token, 'PATCH', `${base}/rows/itemAt(index=${idx})`, {
          values: buildRow(inquiry),
        })
      } else {
        // Row not found — insert instead
        await graph(token, 'POST', `${base}/rows/add`, {
          index:  0,
          values: buildRow(inquiry),
        })
      }
    }

    res.status(200).json({ success: true })

  } catch (err) {
    console.error('[sync-excel]', err.message)
    // Return 200 so the app doesn't show an error to the user
    // Excel sync failure should never block the user
    res.status(200).json({ success: false, error: err.message })
  }
}
