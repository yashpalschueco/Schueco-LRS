// api/sync-onedrive.js
// Relays inquiry data to Power Automate for Excel sync + email notification

// ── Full-record field order for the email body (Option B: full record,
// changed rows highlighted). Keys must match the `inquiry` payload fields
// sent by NewInquiry.jsx / EditInquiry.jsx / Dashboard.jsx exactly. ─────────
const FIELD_ORDER = [
  ['client_name',         'Client Name'],
  ['project_name',        'Project Name'],
  ['status',              'Status'],
  ['project_value',       'Project Value (Cr)'],
  ['site_location',       'Site Location'],
  ['region',              'Region'],
  ['source',              'Source'],
  ['responsible_name',    'Responsible'],
  ['fabricator_name',     'Fabricator'],
  ['partner2_name',       'Fabricator 2'],
  ['partner3_name',       'Fabricator 3'],
  ['architect_name',      'Architect'],
  ['meeting_with_client', 'Meeting w/ End Client'],
  ['legacy_new',          'Legacy / New'],
  ['products_offered',    'Products Offered'],
  ['project_details_date','Project Details Date'],
  ['cps_notes',           'CPS No.'],
  ['boq_received',        'BOQ Received'],
  ['quote_approved',      'Quote Approved'],
  ['be_month_booking',    'BE Month of Booking'],
  ['material_delivered',  'Material Delivered'],
  ['be_month_invoicing',  'BE Month of Invoicing'],
  ['notes',               'Sales Remarks'],
]

function esc(v) {
  return String(v == null || v === '' ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Builds an Outlook-safe (table-based, inline-styled) HTML email body:
// every field is shown; rows present in `changedFields` are highlighted
// amber with an "old → new" value. `changedFields` is [] for insert/delete,
// so those emails render as a plain full-record table with no highlights.
function buildEmailHtml(inquiry, changedFields, actionLabel) {
  const changedMap = {}
  ;(changedFields || []).forEach(c => { if (c && c.key) changedMap[c.key] = c })

  const rows = FIELD_ORDER.map(([key, label]) => {
    const changed = changedMap[key]
    if (changed) {
      return `<tr style="background:#FCEBD5;">
        <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:13px;color:#854F0B;font-weight:bold;width:38%;border:none;">${esc(label)}</td>
        <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:13px;color:#854F0B;border:none;">${esc(changed.old)} &rarr; ${esc(changed.new)}</td>
      </tr>`
    }
    const value = inquiry[key]
    return `<tr>
      <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:13px;color:#5A5450;width:38%;border:none;">${esc(label)}</td>
      <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:13px;color:#111827;border:none;">${esc(value) || '&mdash;'}</td>
    </tr>`
  }).join('')

  return `<table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;font-family:Arial,sans-serif;">
    <tr><td colspan="2" style="padding:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#9C998F;border:none;">Inquiry #${esc(inquiry.serial_no)} ${esc(actionLabel)}</td></tr>
    <tr><td colspan="2" style="padding:0 0 14px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#111827;border:none;">${esc(inquiry.client_name)} &middot; ${esc(inquiry.project_name)}</td></tr>
    ${rows}
  </table>`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  try {
    const { action, action_by, changes, changed_fields, inquiry } = req.body
    if (!inquiry?.id) return res.status(400).json({ error: 'No inquiry data' })

    const webhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('[sync-onedrive] POWER_AUTOMATE_WEBHOOK_URL not set')
      return res.status(200).json({ success: false, error: 'Webhook URL not configured' })
    }

    const actionLabel = action === 'insert' ? 'registered' : action === 'delete' ? 'deleted' : 'updated'
    const emailBodyHtml = buildEmailHtml(inquiry, changed_fields, actionLabel)

    const paResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // ── Action metadata ──────────────────────────────────────
        action:              action   || '',
        action_by:           action_by || '',
        changes:             changes  || '',   // for updates: "Field: old → new"
        changed_fields:      JSON.stringify(changed_fields || []), // structured diff, [] for insert/delete
        email_body_html:     emailBodyHtml,    // ready-to-send HTML — full record, changed rows highlighted

        // ── SharePoint columns (A–O, T–Y) ────────────────────────
        serial_no:           inquiry.serial_no           || '',
        id:                  inquiry.id                  || '',
        status:              inquiry.status              || '',
        project_value:       String(inquiry.project_value || ''),
        created_at:          inquiry.created_at ? inquiry.created_at.split('T')[0] : '',
        cps_notes:           inquiry.cps_notes           || '',
        responsible_name:    inquiry.responsible_name    || '',
        region:              inquiry.region              || '',
        site_location:       inquiry.site_location       || '',
        architect_name:      inquiry.architect_name      || '',
        fabricator_name:     inquiry.fabricator_name     || '',
        client_name:         inquiry.client_name         || '',
        project_name:        inquiry.project_name        || '',
        meeting_with_client: inquiry.meeting_with_client || '',
        legacy_new:          inquiry.legacy_new          || '',
        products_offered:    inquiry.products_offered    || '',
        project_details_date:inquiry.project_details_date|| '',
        quote_approved:      inquiry.quote_approved      || '',
        be_month_booking:    inquiry.be_month_booking    || '',
        material_delivered:  inquiry.material_delivered  || '',
        be_month_invoicing:  inquiry.be_month_invoicing  || '',
        boq_received:        inquiry.boq_received        || '',
        notes:               inquiry.notes               || '',

        // ── App-only fields (not in SharePoint) ─────────────────
        source:              inquiry.source              || '',
        partner2_name:       inquiry.partner2_name       || '',
        partner3_name:       inquiry.partner3_name       || '',
      })
    })

    if (!paResponse.ok) {
      const errText = await paResponse.text()
      console.error('[sync-onedrive] Power Automate error:', paResponse.status, errText)
      return res.status(200).json({ success: false, error: `PA returned ${paResponse.status}` })
    }

    res.status(200).json({ success: true })

  } catch (err) {
    console.error('[sync-onedrive]', err.message)
    res.status(200).json({ success: false, error: err.message })
  }
}
