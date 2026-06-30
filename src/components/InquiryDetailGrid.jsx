import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}
function fmtFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Shared "expanded inquiry detail" block — used by the Dashboard row expand
// AND the New Inquiry duplicate-check match panel, so both look identical.
export default function InquiryDetailGrid({ inq }) {
  const [files, setFiles] = useState([])
  const [filesLoaded, setFilesLoaded] = useState(false)

  useEffect(() => {
    supabase.from('inquiry_files').select('*').eq('inquiry_id', inq.id).order('created_at')
      .then(({ data }) => { setFiles(data || []); setFilesLoaded(true) })
  }, [inq.id])

  async function openFile(filePath) {
    const { data, error } = await supabase.storage.from('inquiry-files').createSignedUrl(filePath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else console.warn('Could not open file:', error)
  }

  const fields = [
    { label: 'Site Location',          value: inq.site_location },
    { label: 'Region',                 value: inq.region },
    { label: 'Source',                 value: inq.source },
    { label: 'Meeting w/ End Client',  value: inq.meeting_with_client },
    { label: 'Legacy / New',           value: inq.legacy_new },
    { label: 'Products Offered',       value: inq.products_offered },
    { label: 'Project Details Received', value: inq.project_details_received
        ? `Yes${inq.project_details_date ? ' · ' + fmt(inq.project_details_date) : ''}`
        : 'No' },
    { label: 'CPS',                    value: inq.cps_notes },
    { label: 'Notes',                  value: inq.notes },
    { label: 'Registered by',          value: (inq.created_by_email || '').split('@')[0] || 'Imported' },
    { label: 'Date',                   value: fmt(inq.created_at) },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-3">
        {fields.map(f => (
          <div key={f.label}>
            <div className="text-[10px] font-medium tracking-wider text-gray-400 mb-0.5">{f.label.toUpperCase()}</div>
            <div className="text-sm text-gray-700">{f.value || <span className="text-gray-300">—</span>}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-[10px] font-medium tracking-wider text-gray-400 mb-2">ATTACHMENTS</div>
        {!filesLoaded ? (
          <p className="text-xs text-gray-400">Loading files...</p>
        ) : files.length === 0 ? (
          <p className="text-xs text-gray-300">No files attached</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {files.map(f => (
              <button key={f.id} onClick={() => openFile(f.file_path)}
                className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:border-gray-400 transition-colors">
                <span className="text-gray-400">📎</span>
                <span className="text-gray-700">{f.file_name}</span>
                <span className="text-[11px] text-gray-400">{fmtFileSize(f.file_size)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
