import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import SearchableSelect from '../components/SearchableSelect'
import FileUploader from '../components/FileUploader'
import { useAuth } from '../App'

const REGIONS  = ['North', 'South', 'West', 'Central', 'East']
const SOURCES  = ['Architect', 'PMC', 'Schueco', 'End Client', 'Fabricator']
const STATUSES = ['New', 'Quoted', 'Won', 'Lost']

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">
        {label}{required && <span style={{ color: '#C9A44A' }} className="ml-1">*</span>}
        {hint && <span className="ml-2 normal-case tracking-normal font-normal text-gray-300">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
function SectionLabel({ children }) {
  return <p className="text-[10px] font-semibold tracking-[0.16em] mb-4" style={{ color: '#C9A44A' }}>{children}</p>
}
function Divider() { return <div className="border-t border-gray-100 my-5" /> }

export default function EditInquiry() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { session }  = useAuth()

  const [architects,    setArchitects]    = useState([])
  const [fabricators,   setFabricators]   = useState([])
  const [team,          setTeam]          = useState([])
  const [form,          setForm]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [pendingFiles,  setPendingFiles]  = useState([])
  const [existingFiles, setExistingFiles] = useState([])
  const [removedFileIds,setRemovedFileIds]= useState([])
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [notAuthorized, setNotAuthorized] = useState(false)

  const getName = (list, id) => (list.find(x => x.id === id) || {}).name || null

  useEffect(() => {
    async function load() {
      const [a, f, t, inqRes, filesRes] = await Promise.all([
        supabase.from('architects').select('*').order('name'),
        supabase.from('fabricators').select('*').order('name'),
        supabase.from('schueco_team').select('*').order('name'),
        supabase.from('inquiries').select('*').eq('id', id).single(),
        supabase.from('inquiry_files').select('*').eq('inquiry_id', id).order('created_at'),
      ])
      if (a.data) setArchitects(a.data)
      if (f.data) setFabricators(f.data)
      if (t.data) setTeam(t.data)
      if (filesRes.data) setExistingFiles(filesRes.data)

      const inq = inqRes.data
      if (!inq) { navigate('/'); return }

      if (inq.created_by_email && inq.created_by_email !== session?.user?.email) {
        setNotAuthorized(true)
        setLoading(false)
        return
      }

      setForm({
        clientName:              inq.client_name                || '',
        projectName:             inq.project_name               || '',
        siteLocation:            inq.site_location              || '',
        region:                  inq.region                     || '',
        source:                  inq.source                     || '',
        projectValue:            inq.project_value              || '',
        meetingWithClient:       inq.meeting_with_client        || '',
        legacyNew:               inq.legacy_new                 || '',
        productsOffered:         inq.products_offered           || '',
        projectDetailsReceived:  inq.project_details_received   || false,
        projectDetailsDate:      inq.project_details_date       || '',
        schuecoPersonId:         inq.schueco_person_id          || '',
        fabricatorId:            inq.fabricator_id              || '',
        architectId:             inq.architect_id               || '',
        cpsNotes:                inq.cps_notes                  || '',
        notes:                   inq.notes                      || '',
        status:                  inq.status                     || 'New',
        serialNo:                inq.serial_no                  || null,
      })
      setLoading(false)
    }
    load()
  }, [id, session, navigate])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.clientName.trim() || !form.projectName.trim()) {
      setError('Client name and project name are required.')
      return
    }
    if (!form.schuecoPersonId || !form.fabricatorId || !form.architectId) {
      setError('Please assign all owners.')
      return
    }

    setSaving(true)
    const { error: err } = await supabase.from('inquiries').update({
      client_name:               form.clientName.trim(),
      project_name:              form.projectName.trim(),
      site_location:             form.siteLocation.trim(),
      region:                    form.region              || null,
      source:                    form.source              || null,
      project_value:             form.projectValue ? parseFloat(form.projectValue) : null,
      meeting_with_client:       form.meetingWithClient   || null,
      legacy_new:                form.legacyNew           || null,
      products_offered:          form.productsOffered.trim() || null,
      project_details_received:  form.projectDetailsReceived,
      project_details_date:      (form.projectDetailsReceived && form.projectDetailsDate) ? form.projectDetailsDate : null,
      schueco_person_id:         form.schuecoPersonId     || null,
      fabricator_id:             form.fabricatorId        || null,
      architect_id:              form.architectId         || null,
      responsible_name:          getName(team, form.schuecoPersonId),
      fabricator_name:           getName(fabricators, form.fabricatorId),
      architect_name:            getName(architects, form.architectId),
      cps_notes:                 form.cpsNotes.trim()     || null,
      notes:                     form.notes.trim()        || null,
      status:                    form.status,
    }).eq('id', id)

    setSaving(false)
    if (err) { setError('Failed to save. Please try again.'); return }

    // Sync updated data to OneDrive Excel — non-blocking
    fetch('/api/sync-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        inquiry: {
          id:                  id,
          serial_no:           form.serialNo,
          client_name:         form.clientName.trim(),
          status:              form.status,
          project_value:       form.projectValue || '',
          cps_notes:           form.cpsNotes.trim(),
          responsible_name:    getName(team, form.schuecoPersonId),
          region:              form.region,
          site_location:       form.siteLocation.trim(),
          architect_name:      getName(architects, form.architectId),
          meeting_with_client: form.meetingWithClient,
          legacy_new:          form.legacyNew,
        }
      })
    }).catch(e => console.warn('Excel sync skipped:', e))

    // Remove files the user deleted (storage object + DB row)
    for (const fileId of removedFileIds) {
      const fileRow = existingFiles.find(f => f.id === fileId)
      if (fileRow) {
        await supabase.storage.from('inquiry-files').remove([fileRow.file_path])
        await supabase.from('inquiry_files').delete().eq('id', fileId)
      }
    }

    // Upload any newly added files
    for (const file of pendingFiles) {
      const path = `${id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('inquiry-files').upload(path, file)
      if (!upErr) {
        await supabase.from('inquiry_files').insert({
          inquiry_id:  id,
          file_name:   file.name,
          file_path:   path,
          file_size:   file.size,
          uploaded_by: session?.user?.email || null,
        })
      } else {
        console.warn('File upload failed:', file.name, upErr)
      }
    }

    navigate('/')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  if (notAuthorized) return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto sm:mx-0">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="font-medium text-red-700 mb-2">Not authorised</p>
        <p className="text-sm text-red-600 mb-4">You can only edit inquiries you registered.</p>
        <button onClick={() => navigate('/')} className="text-sm text-gray-500 underline">Back to Dashboard</button>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto sm:mx-0">
      <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1.5 transition-colors">
        ← Back to Dashboard
      </button>
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">Edit Inquiry</h1>
        <p className="text-sm text-gray-500 mt-1">Update details for this inquiry.</p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionLabel>CLIENT DETAILS</SectionLabel>
        <div className="space-y-4">
          <Field label="CLIENT NAME" required>
            <input value={form.clientName} onChange={e => set('clientName', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <Field label="PROJECT NAME" required>
            <input value={form.projectName} onChange={e => set('projectName', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <Field label="SITE LOCATION">
            <input value={form.siteLocation} onChange={e => set('siteLocation', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="REGION">
              <select value={form.region} onChange={e => set('region', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
                <option value="">Select...</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="SOURCE">
              <select value={form.source} onChange={e => set('source', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
                <option value="">Select...</option>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="PROJECT VALUE (INR Cr.)" hint="(optional)">
              <input type="number" step="0.01" min="0" value={form.projectValue} onChange={e => set('projectValue', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
            </Field>
            <Field label="STATUS">
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <Divider />

        <SectionLabel>PROJECT INFO</SectionLabel>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="MEETING WITH END CLIENT">
              <select value={form.meetingWithClient} onChange={e => set('meetingWithClient', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
                <option value="">Select...</option>
                <option>Yes</option><option>No</option>
              </select>
            </Field>
            <Field label="LEGACY / NEW">
              <select value={form.legacyNew} onChange={e => set('legacyNew', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
                <option value="">Select...</option>
                <option>Legacy</option><option>New</option>
              </select>
            </Field>
          </div>
          <Field label="PRODUCTS OFFERED" hint="(optional)">
            <input value={form.productsOffered} onChange={e => set('productsOffered', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <div>
            <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-2">PROJECT DETAILS RECEIVED</label>
            <div className="flex items-center gap-3 mb-2">
              <button type="button" onClick={() => set('projectDetailsReceived', !form.projectDetailsReceived)}
                className="relative inline-flex h-5 w-9 rounded-full flex-shrink-0 transition-colors duration-200"
                style={{ background: form.projectDetailsReceived ? '#0F0F0F' : '#E5E7EB' }}>
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5"
                  style={{ transform: form.projectDetailsReceived ? 'translateX(18px)' : 'translateX(2px)' }} />
              </button>
              <span className="text-sm text-gray-600">{form.projectDetailsReceived ? 'Yes' : 'No'}</span>
            </div>
            {form.projectDetailsReceived && (
              <input type="date" value={form.projectDetailsDate} onChange={e => set('projectDetailsDate', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
            )}
          </div>
        </div>

        <Divider />

        <SectionLabel>ASSIGN OWNERS</SectionLabel>
        <div className="space-y-4">
          <Field label="RESPONSIBLE FOR PROJECT" required>
            <select value={form.schuecoPersonId} onChange={e => set('schuecoPersonId', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
              <option value="">Select...</option>
              {team.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="FABRICATOR / PARTNER" required>
            <SearchableSelect options={fabricators} value={form.fabricatorId} onChange={v => set('fabricatorId', v)} placeholder="Search fabricator..." />
          </Field>
          <Field label="ARCHITECT" required>
            <SearchableSelect options={architects} value={form.architectId} onChange={v => set('architectId', v)} placeholder="Search architect..." />
          </Field>
          <Field label="CPS — CUSTOMER & PROJECT SERVICES" hint="(optional)">
            <textarea value={form.cpsNotes} onChange={e => set('cpsNotes', e.target.value)} rows={2}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 resize-none transition-colors" />
          </Field>
        </div>

        <Divider />

        <Field label="NOTES" hint="(optional)">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 resize-none transition-colors" />
        </Field>

        <Divider />

        <FileUploader
          pendingFiles={pendingFiles}
          existingFiles={existingFiles.filter(f => !removedFileIds.includes(f.id))}
          onAddPending={(files) => setPendingFiles(prev => [...prev, ...files])}
          onRemovePending={(idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
          onRemoveExisting={(fileId) => setRemovedFileIds(prev => [...prev, fileId])}
        />

        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-85 transition-opacity" style={{ background: '#0F0F0F' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
