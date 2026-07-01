import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import SearchableSelect from '../components/SearchableSelect'
import FileUploader from '../components/FileUploader'
import InquiryDetailGrid from '../components/InquiryDetailGrid'
import { findClientMatches } from '../utils/fuzzy'

const REGIONS = ['North', 'South', 'West', 'Central', 'East']
const SOURCES = ['Architect', 'PMC', 'Schueco', 'End Client', 'Fabricator']

function genId() { return 'INQ-' + Date.now().toString(36).toUpperCase().slice(-5) }
function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

// ── Module-level helpers (never inside component) ─────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">
        {label}
        {required && <span style={{ color: '#C9A44A' }} className="ml-1">*</span>}
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function NewInquiry() {
  const navigate   = useNavigate()
  const warningRef = useRef(null)
  const debounceRef = useRef(null)

  const [architects,    setArchitects]    = useState([])
  const [fabricators,   setFabricators]   = useState([])
  const [team,          setTeam]          = useState([])
  const [allInquiries,  setAllInquiries]  = useState([])

  const [form, setForm] = useState({
    clientName: '', projectName: '', siteLocation: '', region: '', source: '',
    projectValue: '', meetingWithClient: '', legacyNew: '',
    productsOffered: '', projectDetailsReceived: false, projectDetailsDate: '',
    schuecoPersonId: '', fabricatorId: '', architectId: '',
    cpsNotes: '', notes: '',
  })
  const [pendingFiles, setPendingFiles] = useState([])

  const [saving,        setSaving]        = useState(false)
  const [formError,     setFormError]     = useState('')
  const [duplicate,     setDuplicate]     = useState(null)   // exact match (red)
  const [clientMatches, setClientMatches] = useState([])     // client-name matches (amber)
  const [expandedMatchId, setExpandedMatchId] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('architects').select('*').order('name'),
      supabase.from('fabricators').select('*').order('name'),
      supabase.from('schueco_team').select('*').order('name'),
      supabase.from('inquiries').select('*'),
    ]).then(([a, f, t, inq]) => {
      if (a.data)   setArchitects(a.data)
      if (f.data)   setFabricators(f.data)
      if (t.data)   setTeam(t.data)
      if (inq.data) setAllInquiries(inq.data)
    })
  }, [])

  // ── Live lookup: fires as the person types the client name ──────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const matches = findClientMatches(form.clientName, allInquiries)
      setClientMatches(matches)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [form.clientName, allInquiries])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setFormError('')
    if (key === 'clientName') setDuplicate(null)
  }

  function scrollToWarning() {
    setTimeout(() => warningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const getName = (list, id) => (list.find(x => x.id === id) || {}).name || '—'

  async function handleSubmit(e, opts = {}) {
    if (e) e.preventDefault()
    setFormError('')
    setDuplicate(null)

    const { clientName, projectName, siteLocation, region, source, projectValue,
            meetingWithClient, legacyNew, productsOffered, projectDetailsReceived,
            projectDetailsDate, schuecoPersonId, fabricatorId, architectId,
            cpsNotes, notes } = form

    if (!clientName.trim() || !projectName.trim()) {
      setFormError('Client name and project name are required.')
      return
    }
    if (!schuecoPersonId || !fabricatorId || !architectId) {
      setFormError('Please assign a Responsible person, Fabricator, and Architect.')
      return
    }

    setSaving(true)

    // ── Step 1: Exact duplicate check (DB) ────────────────────────────────────
    const { data: existing } = await supabase
      .from('inquiries')
      .select('*')
      .ilike('client_name', clientName.trim())
      .ilike('project_name', projectName.trim())
      .limit(1)

    if (existing && existing.length > 0) {
      setDuplicate(existing[0])
      setSaving(false)
      scrollToWarning()
      return
    }

    // ── Step 2: Client name matches must be reviewed before saving ───────────
    if (clientMatches.length > 0 && !opts.skipClientCheck) {
      setSaving(false)
      scrollToWarning()
      return
    }

    // ── Step 3: Save ──────────────────────────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession()
    const newId = genId()
    const { data: inserted, error } = await supabase.from('inquiries').insert({
      id:                        newId,
      client_name:               clientName.trim(),
      project_name:              projectName.trim(),
      site_location:             siteLocation.trim(),
      region:                    region    || null,
      source:                    source    || null,
      project_value:             projectValue ? parseFloat(projectValue) : null,
      meeting_with_client:       meetingWithClient  || null,
      legacy_new:                legacyNew          || null,
      products_offered:         productsOffered.trim() || null,
      project_details_received:  projectDetailsReceived,
      project_details_date:      (projectDetailsReceived && projectDetailsDate) ? projectDetailsDate : null,
      schueco_person_id:         schuecoPersonId || null,
      fabricator_id:             fabricatorId    || null,
      architect_id:              architectId     || null,
      cps_notes:                 cpsNotes.trim() || null,
      notes:                     notes.trim()    || null,
      status:                    'New',
      created_by_email:          session?.user?.email || null,
    }).select().single()

    setSaving(false)
    if (error) { setFormError('Failed to save. Please try again.'); return }

    // Sync to Google Sheets — non-blocking, won't affect user if it fails
    fetch('/api/sync-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'insert',
        inquiry: {
          id:                  newId,
          serial_no:           inserted?.serial_no,
          client_name:         clientName.trim(),
          status:              'New',
          project_value:       projectValue || '',
          created_at:          new Date().toISOString(),
          cps_notes:           cpsNotes.trim(),
          responsible_name:    getName(team, schuecoPersonId),
          region:              region,
          site_location:       siteLocation.trim(),
          architect_name:      getName(architects, architectId),
          meeting_with_client: meetingWithClient,
          legacy_new:          legacyNew,
        }
      })
    }).catch(e => console.warn('Sheet sync skipped:', e))

    // Upload any attached files now that we have a confirmed inquiry ID
    if (pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const path = `${newId}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('inquiry-files').upload(path, file)
        if (!upErr) {
          await supabase.from('inquiry_files').insert({
            inquiry_id:  newId,
            file_name:   file.name,
            file_path:   path,
            file_size:   file.size,
            uploaded_by: session?.user?.email || null,
          })
        } else {
          console.warn('File upload failed:', file.name, upErr)
        }
      }
    }

    navigate('/')
  }

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto sm:mx-0">
      <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1.5 transition-colors">
        ← Back to Dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">Register Inquiry</h1>
        <p className="text-sm text-gray-500 mt-1">One client — one owner per role. No duplicates.</p>
      </div>

      <div ref={warningRef}>
        {/* Exact duplicate — RED, hard stop */}
        {duplicate && (
          <div className="mb-5 border border-red-200 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-5 py-4 border-b border-red-200">
              <p className="text-sm font-semibold text-red-700">⛔ Exact duplicate — already registered</p>
              <p className="text-xs text-red-600 mt-1">{duplicate.client_name} — {duplicate.project_name}</p>
            </div>
            <div className="bg-red-50/40 px-5 py-4 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <div className="text-gray-500">Status</div>        <div className="font-medium text-gray-800">{duplicate.status}</div>
              <div className="text-gray-500">Registered by</div> <div className="font-medium text-gray-800">{(duplicate.created_by_email || '').split('@')[0] || '—'}</div>
              <div className="text-gray-500">Date</div>          <div className="text-gray-800">{fmt(duplicate.created_at)}</div>
              <div className="text-gray-500">Responsible</div>   <div className="font-medium text-gray-800">{getName(team, duplicate.schueco_person_id)}</div>
              <div className="text-gray-500">Fabricator</div>    <div className="font-medium text-gray-800">{getName(fabricators, duplicate.fabricator_id)}</div>
              <div className="text-gray-500">Architect</div>     <div className="font-medium text-gray-800">{getName(architects, duplicate.architect_id)}</div>
            </div>
          </div>
        )}

        {/* Client name matches — AMBER, live, requires acknowledgement */}
        {!duplicate && clientMatches.length > 0 && (
          <div className="mb-5 border border-amber-300 rounded-xl overflow-hidden">
            <div className="bg-amber-50 px-5 py-4 border-b border-amber-200">
              <p className="text-sm font-semibold text-amber-800">⚠ {clientMatches.length} existing {clientMatches.length === 1 ? 'entry' : 'entries'} found for a similar client name</p>
              <p className="text-xs text-amber-700 mt-1">Please check these before continuing — is this the same client?</p>
            </div>
            <div className="px-5 py-3 bg-amber-50/40">
              {clientMatches.map(m => {
                const sameArchitect = form.architectId && m.architect_id === form.architectId
                const isExpanded = expandedMatchId === m.id
                return (
                  <div key={m.id} className="py-2.5 border-b border-amber-100 last:border-0 text-xs">
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                    >
                      <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-amber-700 text-[10px]" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                        <span className="font-medium text-gray-800">{m.client_name}</span>
                        {m._matchedVia === 'project' && (
                          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">matched on project name</span>
                        )}
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-600">{m.project_name}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500">{getName(team, m.schueco_person_id)}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500">{getName(fabricators, m.fabricator_id)}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500">{getName(architects, m.architect_id)}</span>
                        {sameArchitect && (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-medium">same architect selected</span>
                        )}
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500">{m.status}</span>
                      </div>
                      <div className="text-gray-400 mt-0.5">Registered by {(m.created_by_email || '').split('@')[0] || 'Imported'} · {fmt(m.created_at)}</div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 bg-white border border-amber-100 rounded-lg p-4">
                        <InquiryDetailGrid inq={m} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 bg-amber-50/40 flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => set('clientName', '')}
                className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
              >
                Clear and re-check
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(null, { skipClientCheck: true })}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-85 transition-opacity"
                style={{ background: '#0F0F0F' }}
              >
                Confirmed different — Save Inquiry
              </button>
            </div>
          </div>
        )}
      </div>

      {formError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{formError}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6">

        <SectionLabel>CLIENT DETAILS</SectionLabel>
        <div className="space-y-4">
          <Field label="CLIENT NAME" required>
            <input value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="e.g. Rajan Malhotra" className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
            <p className="text-[11px] text-gray-400 mt-1">We'll check this against existing clients as you type</p>
          </Field>
          <Field label="PROJECT NAME" required>
            <input value={form.projectName} onChange={e => set('projectName', e.target.value)} placeholder="e.g. Malhotra Residence, Juhu" className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <Field label="SITE LOCATION">
            <input value={form.siteLocation} onChange={e => set('siteLocation', e.target.value)} placeholder="e.g. Juhu, Mumbai" className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="REGION">
              <select value={form.region} onChange={e => set('region', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 cursor-pointer">
                <option value="">Select...</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="SOURCE">
              <select value={form.source} onChange={e => set('source', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 cursor-pointer">
                <option value="">Select...</option>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="PROJECT VALUE (INR Cr.)" hint="(optional)">
            <input type="number" step="0.01" min="0" value={form.projectValue} onChange={e => set('projectValue', e.target.value)} placeholder="e.g. 0.5" className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
        </div>

        <Divider />

        <SectionLabel>PROJECT INFO</SectionLabel>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="MEETING WITH END CLIENT">
              <select value={form.meetingWithClient} onChange={e => set('meetingWithClient', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 cursor-pointer">
                <option value="">Select...</option>
                <option>Yes</option><option>No</option>
              </select>
            </Field>
            <Field label="LEGACY / NEW">
              <select value={form.legacyNew} onChange={e => set('legacyNew', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 cursor-pointer">
                <option value="">Select...</option>
                <option>Legacy</option><option>New</option>
              </select>
            </Field>
          </div>
          <Field label="PRODUCTS OFFERED" hint="(optional)">
            <input value={form.productsOffered} onChange={e => set('productsOffered', e.target.value)} placeholder="e.g. AWS 112, ADS 50" className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors" />
          </Field>
          <div>
            <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-2">PROJECT DETAILS RECEIVED</label>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => set('projectDetailsReceived', !form.projectDetailsReceived)}
                className="relative inline-flex h-5 w-9 rounded-full flex-shrink-0 transition-colors duration-200"
                style={{ background: form.projectDetailsReceived ? '#0F0F0F' : '#E5E7EB' }}
              >
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
            <select value={form.schuecoPersonId} onChange={e => set('schuecoPersonId', e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 cursor-pointer">
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
            <textarea value={form.cpsNotes} onChange={e => set('cpsNotes', e.target.value)} placeholder="Paste CPS details here..." rows={2}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 resize-none transition-colors" />
          </Field>
        </div>

        <Divider />

        <Field label="NOTES" hint="(optional)">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional context..." rows={3}
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 resize-none transition-colors" />
        </Field>

        <Divider />

        <FileUploader
          pendingFiles={pendingFiles}
          existingFiles={[]}
          onAddPending={(files) => setPendingFiles(prev => [...prev, ...files])}
          onRemovePending={(idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
          onRemoveExisting={() => {}}
        />

        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-85 transition-opacity" style={{ background: '#0F0F0F' }}>
            {saving ? 'Saving...' : 'Register Inquiry'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
