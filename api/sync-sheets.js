// api/sync-sheets.js
import crypto from 'crypto'

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'

// ── Google Auth ───────────────────────────────────────────────────────────────
function createJWT(creds) {
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const now     = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss:   creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(creds.private_key, 'base64url')
  return `${header}.${payload}.${sig}`
}

async function getToken(creds) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  createJWT(creds),
    }).toString(),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── Sheets API helper ─────────────────────────────────────────────────────────
async function api(token, method, path, body) {
  const res = await fetch(`${SHEETS}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Sheets ${method} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

// ── Get numeric sheet ID by tab name ─────────────────────────────────────────
async function getSheetId(token, spreadsheetId, tabName) {
  const data  = await api(token, 'GET', `/${spreadsheetId}`)
  const sheet = data.sheets.find(s => s.properties.title === tabName)
  if (!sheet) throw new Error(`Tab "${tabName}" not found`)
  return sheet.properties.sheetId
}

// ── Find row number by Inquiry ID (searches column A) ────────────────────────
async function findRow(token, spreadsheetId, tabName, inquiry) {
  const range = encodeURIComponent(`${tabName}!A:A`)
  const data  = await api(token, 'GET', `/${spreadsheetId}/values/${range}`)
  const rows  = data.values || []
  // Search by serial_no (column A) — most reliable identifier
  const sno   = String(inquiry.serial_no || '')
  const id    = String(inquiry.id || '')
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i][0] || '')
    if ((sno && cell === sno) || (id && cell === id)) return i + 1
  }
  return null
}

// ── Build row: columns A–L ────────────────────────────────────────────────────
function buildRow(inq) {
  return [
    inq.serial_no           || inq.id || '',  // Column A: Serial number
    inq.status              || '',
    inq.project_value       || '',
    inq.created_at ? inq.created_at.split('T')[0] : '',
    inq.cps_notes           || '',
    inq.responsible_name    || '',
    inq.region              || '',
    inq.site_location       || '',
    inq.architect_name      || '',
    inq.client_name         || '',
    inq.meeting_with_client || '',
    inq.legacy_new          || '',
  ]
}

// ── Insert at top of data section ────────────────────────────────────────────
async function insertAtTop(token, spreadsheetId, tabName, row) {
  const sheetId  = await getSheetId(token, spreadsheetId, tabName)
  const startRow = parseInt(process.env.GOOGLE_DATA_START_ROW || '3') - 1

  await api(token, 'POST', `/${spreadsheetId}:batchUpdate`, {
    requests: [{
      insertDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: startRow, endIndex: startRow + 1 },
        inheritFromBefore: false,
      }
    }]
  })

  const rowNum = startRow + 1
  const range  = encodeURIComponent(`${tabName}!A${rowNum}:L${rowNum}`)
  await api(token, 'PUT', `/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    values: [row]
  })
}

// ── Update existing row ───────────────────────────────────────────────────────
async function updateRow(token, spreadsheetId, tabName, rowNum, row) {
  const range = encodeURIComponent(`${tabName}!A${rowNum}:L${rowNum}`)
  await api(token, 'PUT', `/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    values: [row]
  })
}

// ── Delete a row entirely (shifts rows up) ───────────────────────────────────
async function deleteRow(token, spreadsheetId, tabName, rowNum) {
  const sheetId = await getSheetId(token, spreadsheetId, tabName)
  await api(token, 'POST', `/${spreadsheetId}:batchUpdate`, {
    requests: [{
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum }
      }
    }]
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  try {
    const { action, inquiry } = req.body
    if (!inquiry?.id) return res.status(400).json({ error: 'No inquiry data' })

    const creds         = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const tabName       = process.env.GOOGLE_SHEET_TAB || 'SB Tracker'
    const token         = await getToken(creds)
    const row           = buildRow(inquiry)

    if (action === 'insert') {
      await insertAtTop(token, spreadsheetId, tabName, row)

    } else if (action === 'update') {
      const rowNum = await findRow(token, spreadsheetId, tabName, inquiry)
      if (rowNum) {
        await updateRow(token, spreadsheetId, tabName, rowNum, row)
      } else {
        await insertAtTop(token, spreadsheetId, tabName, row)
      }

    } else if (action === 'delete') {
      const rowNum = await findRow(token, spreadsheetId, tabName, inquiry)
      if (rowNum) {
        await deleteRow(token, spreadsheetId, tabName, rowNum)
      }
      // If row not found, nothing to do — already gone or never synced
    }

    res.status(200).json({ success: true })

  } catch (err) {
    console.error('[sync-sheets]', err.message)
    res.status(200).json({ success: false, error: err.message })
  }
}
