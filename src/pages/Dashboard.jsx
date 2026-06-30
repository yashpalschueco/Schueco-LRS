import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../App'
import InquiryDetailGrid from '../components/InquiryDetailGrid'

const STATUS_STYLES = {
  New:    'bg-indigo-50 text-indigo-800',
  Quoted: 'bg-amber-50 text-amber-800',
  Won:    'bg-emerald-50 text-emerald-800',
  Lost:   'bg-gray-100 text-gray-500',
}

function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}
function sumValue(list) {
  return list.reduce((acc, i) => acc + (parseFloat(i.project_value) || 0), 0)
}
function fmtCr(val) {
  return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)
}

// ── Detail row shown when a row is expanded ───────────────────────────────────
function DetailRow({ inq, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
          <InquiryDetailGrid inq={inq} />
        </div>
      </td>
    </tr>
  )
}

export default function Dashboard() {
  const navigate      = useNavigate()
  const { session }   = useAuth()

  const [inquiries,    setInquiries]    = useState([])
  const [architects,   setArchitects]   = useState([])
  const [fabricators,  setFabricators]  = useState([])
  const [team,         setTeam]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expandedId,   setExpandedId]   = useState(null)

  const getName = (list, id) => (list.find(x => x.id === id) || {}).name || '—'

  const fetchInquiries = useCallback(async () => {
    const { data } = await supabase
      .from('inquiries').select('*')
      .order('serial_no', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (data) setInquiries(data)
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        fetchInquiries(),
        supabase.from('architects').select('*').order('name').then(({ data }) => data && setArchitects(data)),
        supabase.from('fabricators').select('*').order('name').then(({ data }) => data && setFabricators(data)),
        supabase.from('schueco_team').select('*').order('name').then(({ data }) => data && setTeam(data)),
      ])
      setLoading(false)
    }
    init()
    const channel = supabase.channel('inquiries-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, fetchInquiries)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchInquiries])

  async function changeStatus(id, status) {
    await supabase.from('inquiries').update({ status }).eq('id', id)
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function deleteInquiry(id, clientName) {
    if (!window.confirm(`Remove inquiry for "${clientName}"? This cannot be undone and will also remove it from the Google Sheet.`)) return

    const inq = inquiries.find(i => i.id === id)

    // Clean up any attached files from storage first
    const { data: files } = await supabase.from('inquiry_files').select('*').eq('inquiry_id', id)
    if (files && files.length > 0) {
      await supabase.storage.from('inquiry-files').remove(files.map(f => f.file_path))
      // inquiry_files rows are removed automatically via ON DELETE CASCADE
    }

    // Sync deletion to Google Sheet — non-blocking
    if (inq) {
      fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', inquiry: { id: inq.id, serial_no: inq.serial_no } })
      }).catch(e => console.warn('Sheet delete sync skipped:', e))
    }

    await supabase.from('inquiries').delete().eq('id', id)
    setInquiries(prev => prev.filter(i => i.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const filtered = inquiries.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      i.client_name.toLowerCase().includes(q) ||
      i.project_name.toLowerCase().includes(q) ||
      (i.site_location || '').toLowerCase().includes(q) ||
      (i.region || '').toLowerCase().includes(q) ||
      (i.source || '').toLowerCase().includes(q) ||
      (i.products_offered || '').toLowerCase().includes(q) ||
      getName(architects, i.architect_id).toLowerCase().includes(q) ||
      getName(fabricators, i.fabricator_id).toLowerCase().includes(q) ||
      getName(team, i.schueco_person_id).toLowerCase().includes(q)
    return matchSearch && (statusFilter === 'All' || i.status === statusFilter)
  })

  const totalPipeline    = sumValue(inquiries)
  const filteredPipeline = sumValue(filtered)
  const wonValue         = sumValue(inquiries.filter(i => i.status === 'Won'))
  const showFilteredVal  = statusFilter !== 'All' || search

  const stats = ['New', 'Quoted', 'Won', 'Lost'].map(s => ({
    label: s,
    count: inquiries.filter(i => i.status === s).length,
    value: sumValue(inquiries.filter(i => i.status === s)),
  }))

  const COL_COUNT = 12

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-gray-400">Loading inquiries...</p>
    </div>
  )

  return (
    <div className="p-8">

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Inquiries</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-sm text-gray-500">{inquiries.length} total leads</span>
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1">
              <span className="text-[10px] text-gray-400 tracking-wider">PIPELINE</span>
              <span className="text-sm font-semibold text-gray-900">₹{fmtCr(totalPipeline)} Cr</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1">
              <span className="text-[10px] text-emerald-600 tracking-wider">WON</span>
              <span className="text-sm font-semibold text-emerald-700">₹{fmtCr(wonValue)} Cr</span>
            </div>
            {showFilteredVal && filteredPipeline !== totalPipeline && (
              <div className="flex items-center gap-1.5 rounded-lg px-3 py-1" style={{ background: 'rgba(201,164,74,0.1)', border: '1px solid rgba(201,164,74,0.3)' }}>
                <span className="text-[10px] tracking-wider" style={{ color: '#C9A44A' }}>FILTERED</span>
                <span className="text-sm font-semibold" style={{ color: '#8B6914' }}>₹{fmtCr(filteredPipeline)} Cr</span>
              </div>
            )}
          </div>
        </div>
        <button onClick={() => navigate('/new')} className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-85 transition-opacity flex-shrink-0" style={{ background: '#0F0F0F' }}>
          + New Inquiry
        </button>
      </div>

      {/* ── Status cards ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {stats.map(s => (
          <div key={s.label} onClick={() => setStatusFilter(prev => prev === s.label ? 'All' : s.label)}
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 cursor-pointer min-w-[90px] transition-all"
            style={{ borderTop: `2px solid ${statusFilter === s.label ? '#C9A44A' : 'transparent'}` }}>
            <div className="text-xl font-medium text-gray-900">{s.count}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 tracking-wider">{s.label.toUpperCase()}</div>
            {s.value > 0 && <div className="text-[11px] text-gray-400 mt-1">₹{fmtCr(s.value)} Cr</div>}
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by client, project, architect, fabricator, responsible, region, source or products..."
        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-gray-400 mb-3 transition-colors" />

      {/* ── Click to expand hint ── */}
      {filtered.length > 0 && (
        <p className="text-[11px] text-gray-400 mb-3 flex items-center gap-1.5">
          <span>▶</span> Click any row to see all details
        </p>
      )}

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <div className="text-4xl mb-3 opacity-20">📋</div>
          <p className="font-medium text-gray-700 mb-1">{inquiries.length ? 'No matches' : 'No inquiries yet'}</p>
          <p className="text-sm text-gray-400">{inquiries.length ? 'Try a different search or filter.' : 'Register the first inquiry to get started.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#','','Client','Project','Responsible','Fabricator','Architect','Value (Cr)','Status','Date',''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-medium text-gray-400 tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inq, idx) => {
                  const isOwner    = inq.created_by_email === session?.user?.email || !inq.created_by_email
                  const isExpanded = expandedId === inq.id

                  return (
                    <>
                      <tr
                        key={inq.id}
                        onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                        style={{ background: isExpanded ? '#FAFAF8' : undefined }}
                      >
                        {/* Sequence number */}
                        <td className="px-3 py-3 text-[11px] text-gray-400 font-mono w-8 text-right">{inq.serial_no || (filtered.length - idx)}</td>
                        {/* Expand toggle */}
                        <td className="px-3 py-3 w-6">
                          <span className="text-gray-300 text-[10px] transition-transform inline-block"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap max-w-[140px] truncate">{inq.client_name}</td>
                        <td className="px-3 py-3 text-gray-700 max-w-[180px]">
                          <div className="truncate">{inq.project_name}</div>
                          {inq.site_location && <div className="text-[11px] text-gray-400 truncate">{inq.site_location}</div>}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap max-w-[110px] truncate">{getName(team, inq.schueco_person_id)}</td>
                        <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap max-w-[120px] truncate">{getName(fabricators, inq.fabricator_id)}</td>
                        <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap max-w-[120px] truncate">{getName(architects, inq.architect_id)}</td>
                        <td className="px-3 py-3 text-[12px] font-medium whitespace-nowrap" style={{ color: inq.project_value ? '#065F46' : '#D1D5DB' }}>
                          {inq.project_value ? `₹${fmtCr(parseFloat(inq.project_value))}` : '—'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {isOwner ? (
                            <select value={inq.status} onChange={e => changeStatus(inq.id, e.target.value)}
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border-none outline-none cursor-pointer appearance-none ${STATUS_STYLES[inq.status] || ''}`}>
                              {['New','Quoted','Won','Lost'].map(s => <option key={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[inq.status] || ''}`}>{inq.status}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-gray-400 whitespace-nowrap">{fmt(inq.created_at)}</td>
                        <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {isOwner ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => navigate(`/edit/${inq.id}`)} className="text-gray-300 hover:text-gray-600 transition-colors text-xs" title="Edit">✎</button>
                              <button onClick={() => deleteInquiry(inq.id, inq.client_name)} className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none" title="Delete">×</button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-300">view only</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {isExpanded && (
                        <DetailRow key={`${inq.id}-detail`} inq={inq} colSpan={COL_COUNT} />
                      )}
                    </>
                  )
                })}
              </tbody>

              {/* ── Footer sum ── */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-3 py-2.5 text-[11px] font-medium text-gray-500" colSpan={6}>
                      {filtered.length} inquiries shown
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-emerald-700">
                      ₹{fmtCr(filteredPipeline)} Cr
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
