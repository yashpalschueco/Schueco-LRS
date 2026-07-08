// api/sync-onedrive.js
// Vercel serverless function — relays inquiry data to Power Automate
// which then writes it to the SharePoint/OneDrive Excel file.
//
// Environment variable needed:
//   POWER_AUTOMATE_WEBHOOK_URL — the HTTP trigger URL from your Power Automate flow
//
// Payload sent to Power Automate:
//   { action: 'insert'|'update'|'delete', inquiry: { serial_no, client_name, ... } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  try {
    const { action, inquiry } = req.body
    if (!inquiry?.id) return res.status(400).json({ error: 'No inquiry data' })

    const webhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('[sync-onedrive] POWER_AUTOMATE_WEBHOOK_URL not set — skipping')
      return res.status(200).json({ success: false, error: 'Webhook URL not configured' })
    }

    // Forward the full payload to Power Automate
    const paResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        inquiry: {
          serial_no:           inquiry.serial_no           || '',
          id:                  inquiry.id                  || '',
          status:              inquiry.status              || '',
          project_value:       inquiry.project_value       || '',
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
          source:              inquiry.source              || '',
          products_offered:    inquiry.products_offered    || '',
          project_details_date: inquiry.project_details_date || '',
          be_month_booking:    inquiry.be_month_booking    || '',
          material_delivered:  inquiry.material_delivered  || '',
          be_month_invoicing:  inquiry.be_month_invoicing  || '',
          quote_approved:      inquiry.quote_approved      || '',
          boq_received:        inquiry.boq_received        || '',
          notes:               inquiry.notes               || '',
        }
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
    // Always return 200 — sync failure should never block the user
    res.status(200).json({ success: false, error: err.message })
  }
}
