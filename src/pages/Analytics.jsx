import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import SearchableSelect from '../components/SearchableSelect'

function fmtCr(val) {
  if (!val || isNaN(parseFloat(val))) return '—'
  const n = parseFloat(val)
  return `₹${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} Cr`
}
function sumVal(list) { return list.reduce((a, i) => a + (parseFloat(i.project_value) || 0), 0) }
function daysSince(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'fabricators',label: 'Fabricators' },
  { id: 'architects', label: 'Architects' },
  { id: 'team',       label: 'Team' },
  { id: 'workload',   label: 'Workload' },
  { id: 'stale',      label: 'Stale Inquiries' },
  { id: 'compare',    label: 'Compare' },
]

const DATE_RANGES = [
  { id: 'all',     label: 'All Time' },
  { id: 'month',   label: 'This Month' },
  { id: 'quarter', label: 'This Quarter' },
]

// ── Reusable bits ─────────────────────────────────────────────────────────────
function HBar({ value, max, color }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-[10px] text-gray-400 tracking-wider mb-2">{label.toUpperCase()}</div>
      <div className="text-2xl font-semibold" style={{ color: color || '#1C1C1C' }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}
function Pill({ children, bg, color }) {
  return <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: bg, color }}>{children}</span>
}

// ── Build stats for any group (fabricator/architect/team) ────────────────────
function buildGroupStats(idField, list, inquiries) {
  return list.map(entity => {
    const r = inquiries.filter(i => i[idField] === entity.id)
    const won = r.filter(i => i.status === 'Won')
    return {
      id: entity.id,
      name: entity.name,
      total: r.length,
      active: r.filter(i => i.status === 'New' || i.status === 'Quoted').length,
      won: won.length,
      lost: r.filter(i => i.status === 'Lost').length,
      pipeline: sumVal(r),
      wonVal: sumVal(won),
      winRate: r.length > 0 ? Math.round((won.length / r.length) * 100) : 0,
      inquiries: r,
    }
  }).filter(s => s.total > 0)
}

export default function Analytics() {
  const [inquiries,   setInquiries]   = useState([])
  const [architects,  setArchitects]  = useState([])
  const [fabricators, setFabricators] = useState([])
  const [team,        setTeam]        = useState([])
  const [loading,     setLoading]     = useState(true)

  const [tab,        setTab]        = useState('overview')
  const [dateRange,  setDateRange]  = useState('all')

  const [drillFabId,  setDrillFabId]  = useState('')
  const [drillArchId, setDrillArchId] = useState('')
  const [drillTeamId, setDrillTeamId] = useState('')

  const [compareType, setCompareType] = useState('fabricator')
  const [compareAId,  setCompareAId]  = useState('')
  const [compareBId,  setCompareBId]  = useState('')

  const [regionMetric, setRegionMetric] = useState('value') // 'value' | 'count'
  const [hoveredSeg,    setHoveredSeg]   = useState(null)    // { monthLabel, region }
  const [workloadOpen,  setWorkloadOpen]  = useState({})     // { fabId: null|'all'|'New'|'Quoted' }

  useEffect(() => {
    async function load() {
      const [inq, arch, fab, tm] = await Promise.all([
        supabase.from('inquiries').select('*'),
        supabase.from('architects').select('*').order('name'),
        supabase.from('fabricators').select('*').order('name'),
        supabase.from('schueco_team').select('*').order('name'),
      ])
      if (inq.data) setInquiries(inq.data)
      if (arch.data) setArchitects(arch.data)
      if (fab.data) setFabricators(fab.data)
      if (tm.data) setTeam(tm.data)
      setLoading(false)
    }
    load()
  }, [])

  // ── Date range filtering ─────────────────────────────────────────────────
  const filteredInquiries = useMemo(() => {
    if (dateRange === 'all') return inquiries
    const now = new Date()
    return inquiries.filter(i => {
      if (!i.created_at) return false
      const d = new Date(i.created_at)
      if (dateRange === 'month') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      if (dateRange === 'quarter') {
        const q = Math.floor(now.getMonth() / 3)
        const dq = Math.floor(d.getMonth() / 3)
        return d.getFullYear() === now.getFullYear() && dq === q
      }
      return true
    })
  }, [inquiries, dateRange])

  if (loading) return (
    <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-400">Loading analytics...</p></div>
  )

  const fabStats  = buildGroupStats('fabricator_id', fabricators, filteredInquiries).sort((a,b) => b.total - a.total)
  const archStats = buildGroupStats('architect_id', architects, filteredInquiries).sort((a,b) => b.total - a.total)
  const teamStats = buildGroupStats('schueco_person_id', team, filteredInquiries).sort((a,b) => b.total - a.total)

  const totalPipeline = sumVal(filteredInquiries)
  const wonPipeline   = sumVal(filteredInquiries.filter(i => i.status === 'Won'))
  const wonCount      = filteredInquiries.filter(i => i.status === 'Won').length
  const winRate       = filteredInquiries.length > 0 ? Math.round((wonCount / filteredInquiries.length) * 100) : 0

  const regionStats = ['North','South','East','West','Central'].map(r => ({
    name: r, count: filteredInquiries.filter(i => i.region === r).length, pipeline: sumVal(filteredInquiries.filter(i => i.region === r)),
  })).filter(r => r.count > 0).sort((a,b) => b.pipeline - a.pipeline)

  const sourceStats = ['Architect','PMC','Schueco','End Client','Fabricator'].map(s => ({
    name: s, count: filteredInquiries.filter(i => i.source === s).length,
  })).filter(s => s.count > 0).sort((a,b) => b.count - a.count)

  // ── Monthly sales by region (stacked) ──────────────────────────────────────
  const REGION_LIST = ['North','South','East','West','Central','Unspecified']
  const REGION_COLORS = { North:'#C9A44A', South:'#0F0F0F', East:'#065F46', West:'#3730A3', Central:'#92400E', Unspecified:'#D1D5DB' }
  const monthRegionMap = {}
  inquiries.forEach(i => {
    if (!i.created_at) return
    const k = i.created_at.slice(0,7)
    const r = REGION_LIST.includes(i.region) ? i.region : 'Unspecified'
    if (!monthRegionMap[k]) monthRegionMap[k] = {}
    if (!monthRegionMap[k][r]) monthRegionMap[k][r] = { count: 0, value: 0 }
    monthRegionMap[k][r].count += 1
    monthRegionMap[k][r].value += (parseFloat(i.project_value) || 0)
  })
  const monthlyRegionStats = Object.entries(monthRegionMap).sort(([a],[b]) => a.localeCompare(b)).slice(-12)
    .map(([key, byRegion]) => ({
      label: new Date(key+'-01').toLocaleDateString('en-IN',{month:'short',year:'2-digit'}),
      byRegion,
      totalValue: REGION_LIST.reduce((acc,r) => acc + (byRegion[r]?.value || 0), 0),
      totalCount: REGION_LIST.reduce((acc,r) => acc + (byRegion[r]?.count || 0), 0),
    }))
  const maxMonthRegionValue = Math.max(...monthlyRegionStats.map(m => m.totalValue), 1)
  const maxMonthRegionCount = Math.max(...monthlyRegionStats.map(m => m.totalCount), 1)

  const maxFab = Math.max(...fabStats.map(f=>f.total),1)
  const maxArch = Math.max(...archStats.map(a=>a.total),1)
  const maxTeam = Math.max(...teamStats.map(t=>t.total),1)
  const maxRegVal = Math.max(...regionStats.map(r=>r.pipeline),1)
  const maxSrc = Math.max(...sourceStats.map(s=>s.count),1)
  const SOURCE_COLORS = ['#C9A44A','#0F0F0F','#065F46','#3730A3','#92400E']

  // ── Workload thresholds ──────────────────────────────────────────────────

  // ── Stale inquiries (15+ days since status last changed, still New/Quoted) ──
  // Uses status_updated_at (resets whenever status changes, e.g. New → Quoted)
  // rather than created_at, so an inquiry that recently moved forward doesn't
  // look stale just because it was first registered a while ago.
  const staleInquiries = inquiries
    .filter(i => (i.status === 'New' || i.status === 'Quoted') && daysSince(i.status_updated_at || i.created_at) >= 15)
    .map(i => ({ ...i, days: daysSince(i.status_updated_at || i.created_at) }))
    .sort((a,b) => b.days - a.days)

  const getName = (list, id) => (list.find(x => x.id === id) || {}).name || '—'

  // ── Top Active Deals — highest-value open opportunities, at a glance ────────
  const topActiveDeals = filteredInquiries
    .filter(i => (i.status === 'New' || i.status === 'Quoted') && parseFloat(i.project_value) > 0)
    .sort((a,b) => parseFloat(b.project_value) - parseFloat(a.project_value))
    .slice(0, 8)

  // ── Drill-down detail builder ────────────────────────────────────────────
  function DrillDownDetail({ stats, color }) {
    if (!stats) return null
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="font-medium text-gray-900 text-sm">{stats.name}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 border-b border-gray-100">
          <SummaryCard label="Total" value={stats.total} />
          <SummaryCard label="Active" value={stats.active} color="#3730A3" />
          <SummaryCard label="Won" value={stats.won} color="#065F46" />
          <SummaryCard label="Win Rate" value={`${stats.winRate}%`} color={color} />
          <SummaryCard label="Pipeline" value={fmtCr(stats.pipeline)} color={color} />
        </div>
        <div className="px-5 py-3 text-[11px] text-gray-400 tracking-wider">RECENT INQUIRIES</div>
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {stats.inquiries.slice(0, 15).map(i => (
            <div key={i.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <div className="font-medium text-gray-800 truncate">{i.client_name}</div>
                <div className="text-[11px] text-gray-400 truncate">{i.project_name}</div>
              </div>
              <Pill bg="#F3F4F6" color="#374151">{i.status}</Pill>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Performance overview across fabricators, architects and regions</p>
        </div>
        {/* Date range filter */}
        <div className="flex bg-white border border-gray-200 rounded-lg p-1">
          {DATE_RANGES.map(d => (
            <button key={d.id} onClick={() => setDateRange(d.id)}
              className="px-3 py-1.5 text-xs rounded-md transition-all"
              style={{ background: dateRange === d.id ? '#0F0F0F' : 'transparent', color: dateRange === d.id ? '#fff' : '#9CA3AF', fontWeight: dateRange === d.id ? 500 : 400 }}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px"
            style={{ borderColor: tab === t.id ? '#C9A44A' : 'transparent', color: tab === t.id ? '#1C1C1C' : '#9CA3AF', fontWeight: tab === t.id ? 500 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Inquiries" value={filteredInquiries.length} sub={dateRange === 'all' ? 'all time' : DATE_RANGES.find(d=>d.id===dateRange).label} />
            <SummaryCard label="Total Pipeline" value={fmtCr(totalPipeline)} color="#C9A44A" sub={`${filteredInquiries.filter(i=>i.status==='New'||i.status==='Quoted').length} active`} />
            <SummaryCard label="Won Value" value={fmtCr(wonPipeline)} color="#065F46" sub={`${wonCount} inquiries closed`} />
            <SummaryCard label="Win Rate" value={`${winRate}%`} color="#0F0F0F" sub={`${wonCount} of ${filteredInquiries.length} converted`} />
          </div>

          {/* Top Active Deals — highest-value open opportunities */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <span className="font-medium text-gray-900 text-sm">Top Active Deals</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Highest-value open opportunities (New or Quoted)</p>
            </div>
            {topActiveDeals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No active deals with a value set yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {topActiveDeals.map((d, idx) => (
                  <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-[11px] text-gray-300 font-mono w-5 text-right flex-shrink-0">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800 truncate">{d.client_name} <span className="text-gray-400 font-normal">— {d.project_name}</span></div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{getName(team, d.schueco_person_id)} · {getName(fabricators, d.fabricator_id)} · {getName(architects, d.architect_id)}</div>
                    </div>
                    <Pill bg={d.status === 'New' ? '#EEF2FF' : '#FFFBEB'} color={d.status === 'New' ? '#3730A3' : '#92400E'}>{d.status}</Pill>
                    <span className="text-sm font-semibold text-emerald-700 flex-shrink-0 w-20 text-right">{fmtCr(parseFloat(d.project_value))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><span className="font-medium text-gray-900 text-sm">Pipeline by Region</span></div>
              <div className="p-5 space-y-4">
                {regionStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No data</p> : regionStats.map(r => (
                  <div key={r.name}>
                    <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-700 font-medium">{r.name}</span><span className="text-gray-400 text-xs">{r.count} inquiries</span></div>
                    <HBar value={r.pipeline} max={maxRegVal} color="#C9A44A" />
                    <div className="text-[11px] text-gray-400 mt-1">{fmtCr(r.pipeline)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><span className="font-medium text-gray-900 text-sm">Source Breakdown</span></div>
              <div className="p-5 space-y-4">
                {sourceStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No data</p> : sourceStats.map((s,i) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-700 font-medium">{s.name}</span><span className="text-gray-400 text-xs">{s.count} · {Math.round((s.count/filteredInquiries.length)*100)}%</span></div>
                    <HBar value={s.count} max={maxSrc} color={SOURCE_COLORS[i%SOURCE_COLORS.length]} />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><span className="font-medium text-gray-900 text-sm">Pipeline by Status</span></div>
              <div className="p-5 space-y-3">
                {[{label:'New',color:'#3730A3',bg:'#EEF2FF'},{label:'Quoted',color:'#92400E',bg:'#FFFBEB'},{label:'Won',color:'#065F46',bg:'#ECFDF5'},{label:'Lost',color:'#6B7280',bg:'#F3F4F6'}].map(s => {
                  const related = filteredInquiries.filter(i => i.status === s.label)
                  const val = sumVal(related)
                  return (
                    <div key={s.label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: s.bg }}>
                      <div><div className="text-sm font-medium" style={{ color: s.color }}>{s.label}</div><div className="text-xs mt-0.5" style={{ color: s.color }}>{related.length} inquiries</div></div>
                      <div className="text-sm font-semibold" style={{ color: s.color }}>{val > 0 ? fmtCr(val) : '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Monthly Sales by Region — toggle between Value and Count, custom tooltip */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium text-gray-900 text-sm">Monthly Sales by Region (last 12 months)</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Hover a segment for exact value and count</p>
              </div>
              <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-1">
                {[{ id: 'value', label: 'Value' }, { id: 'count', label: 'Count' }].map(opt => (
                  <button key={opt.id} onClick={() => setRegionMetric(opt.id)}
                    className="px-3 py-1 text-xs rounded-md transition-all"
                    style={{ background: regionMetric === opt.id ? '#0F0F0F' : 'transparent', color: regionMetric === opt.id ? '#fff' : '#9CA3AF', fontWeight: regionMetric === opt.id ? 500 : 400 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5">
              {monthlyRegionStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No data</p> : (
                <>
                  <div className="flex items-end gap-2" style={{ height: 230 }}>
                    {monthlyRegionStats.map(m => {
                      const monthTotal = regionMetric === 'value' ? m.totalValue : m.totalCount
                      const monthMax   = regionMetric === 'value' ? maxMonthRegionValue : maxMonthRegionCount
                      return (
                        <div key={m.label} className="flex-1 flex flex-col items-center gap-1 min-w-0" style={{ position: 'relative' }}>
                          <div className="text-[10px] text-gray-500 font-medium">
                            {monthTotal > 0 ? (regionMetric === 'value' ? fmtCr(monthTotal) : monthTotal) : ''}
                          </div>
                          <div className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse" style={{ height: 180 }}>
                            {REGION_LIST.map(r => {
                              const seg = m.byRegion[r]
                              const segVal = seg ? (regionMetric === 'value' ? seg.value : seg.count) : 0
                              if (!seg || segVal <= 0) return null
                              const segHeight = Math.max(2, (segVal / monthMax) * 180)
                              const isHovered = hoveredSeg && hoveredSeg.monthLabel === m.label && hoveredSeg.region === r
                              return (
                                <div
                                  key={r}
                                  onMouseEnter={() => setHoveredSeg({ monthLabel: m.label, region: r })}
                                  onMouseLeave={() => setHoveredSeg(null)}
                                  style={{ height: `${segHeight}px`, background: REGION_COLORS[r], opacity: isHovered ? 1 : 0.85, outline: isHovered ? '2px solid rgba(0,0,0,0.15)' : 'none', outlineOffset: '-1px' }}
                                  className="w-full cursor-default transition-opacity"
                                />
                              )
                            })}
                          </div>
                          <div className="text-[9px] text-gray-400 text-center truncate w-full">{m.label}</div>

                          {/* Custom tooltip */}
                          {hoveredSeg && hoveredSeg.monthLabel === m.label && m.byRegion[hoveredSeg.region] && (
                            <div
                              className="absolute bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap"
                              style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, zIndex: 20 }}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: REGION_COLORS[hoveredSeg.region] }} />
                                <span className="font-medium text-gray-800">{hoveredSeg.region}</span>
                                <span className="text-gray-400">· {m.label}</span>
                              </div>
                              <div className="text-gray-600">{fmtCr(m.byRegion[hoveredSeg.region].value)}</div>
                              <div className="text-gray-600">{m.byRegion[hoveredSeg.region].count} {m.byRegion[hoveredSeg.region].count === 1 ? 'inquiry' : 'inquiries'}</div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
                    {REGION_LIST.map(r => (
                      <div key={r} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: REGION_COLORS[r] }} />
                        {r}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── FABRICATORS ── */}
      {tab === 'fabricators' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">VIEW DETAILS FOR A SPECIFIC FABRICATOR</label>
            <SearchableSelect options={fabricators} value={drillFabId} onChange={setDrillFabId} placeholder="Select a fabricator..." />
          </div>
          {drillFabId ? (
            <DrillDownDetail stats={fabStats.find(f => f.id === drillFabId) || { name: getName(fabricators, drillFabId), total:0, active:0, won:0, winRate:0, pipeline:0, inquiries:[] }} color="#C9A44A" />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <span style={{ color: '#C9A44A' }}>⬡</span><span className="font-medium text-gray-900 text-sm">Fabricator Performance</span>
                <span className="ml-auto text-xs text-gray-400">{fabStats.length} with inquiries</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
                {fabStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No data yet</p> : fabStats.map(f => (
                  <div key={f.name} className="px-5 py-3.5 cursor-pointer hover:bg-gray-50" onClick={() => setDrillFabId(f.id)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate mr-2">{f.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                        <Pill bg="#EEF2FF" color="#3730A3">{f.active} active</Pill>
                        <Pill bg="#ECFDF5" color="#065F46">{f.won} won</Pill>
                        <span className="text-gray-400">{f.total} total</span>
                      </div>
                    </div>
                    <HBar value={f.total} max={maxFab} color="#C9A44A" />
                    {f.pipeline > 0 && <div className="text-[11px] text-gray-400 mt-1">{fmtCr(f.pipeline)} pipeline · {f.winRate}% win rate</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ARCHITECTS ── */}
      {tab === 'architects' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">VIEW DETAILS FOR A SPECIFIC ARCHITECT</label>
            <SearchableSelect options={architects} value={drillArchId} onChange={setDrillArchId} placeholder="Select an architect..." />
          </div>
          {drillArchId ? (
            <DrillDownDetail stats={archStats.find(a => a.id === drillArchId) || { name: getName(architects, drillArchId), total:0, active:0, won:0, winRate:0, pipeline:0, inquiries:[] }} color="#0F0F0F" />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <span style={{ color: '#C9A44A' }}>△</span><span className="font-medium text-gray-900 text-sm">Architect Performance</span>
                <span className="ml-auto text-xs text-gray-400">{archStats.length} with inquiries</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
                {archStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No data yet</p> : archStats.map(a => (
                  <div key={a.name} className="px-5 py-3.5 cursor-pointer hover:bg-gray-50" onClick={() => setDrillArchId(a.id)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate mr-2">{a.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                        <Pill bg="#EEF2FF" color="#3730A3">{a.active} active</Pill>
                        <Pill bg="#ECFDF5" color="#065F46">{a.won} won</Pill>
                        <span className="text-gray-400">{a.total} total</span>
                      </div>
                    </div>
                    <HBar value={a.total} max={maxArch} color="#0F0F0F" />
                    {a.pipeline > 0 && <div className="text-[11px] text-gray-400 mt-1">{fmtCr(a.pipeline)} pipeline · {a.winRate}% win rate</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TEAM ── */}
      {tab === 'team' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">VIEW DETAILS FOR A TEAM MEMBER</label>
            <select value={drillTeamId} onChange={e => setDrillTeamId(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 outline-none cursor-pointer">
              <option value="">Select a team member...</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {drillTeamId ? (
            <DrillDownDetail stats={teamStats.find(t => t.id === drillTeamId) || { name: getName(team, drillTeamId), total:0, active:0, won:0, winRate:0, pipeline:0, inquiries:[] }} color="#92400E" />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <span style={{ color: '#C9A44A' }}>◎</span><span className="font-medium text-gray-900 text-sm">Team Performance</span>
                <span className="ml-auto text-xs text-gray-400">{teamStats.length} with inquiries</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
                {teamStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No data yet</p> : teamStats.map(t => (
                  <div key={t.name} className="px-5 py-3.5 cursor-pointer hover:bg-gray-50" onClick={() => setDrillTeamId(t.id)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate mr-2">{t.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                        <Pill bg="#EEF2FF" color="#3730A3">{t.active} active</Pill>
                        <Pill bg="#ECFDF5" color="#065F46">{t.won} won</Pill>
                        <span className="text-gray-400">{t.total} total</span>
                      </div>
                    </div>
                    <HBar value={t.total} max={maxTeam} color="#92400E" />
                    {t.pipeline > 0 && <div className="text-[11px] text-gray-400 mt-1">{fmtCr(t.pipeline)} pipeline · {t.winRate}% win rate</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── WORKLOAD ── */}
      {tab === 'workload' && (() => {
        function toggleWorkload(fabId, type) {
          setWorkloadOpen(prev => ({
            ...prev,
            [fabId]: prev[fabId] === type ? null : type
          }))
        }

        const sorted = [...fabStats].sort((a,b) => b.active - a.active)

        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <span className="font-medium text-gray-900 text-sm">Fabricator Workload</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Click a name or count to expand individual inquiries</p>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-medium tracking-wider text-gray-400">
              <div className="col-span-4">FABRICATOR</div>
              <div className="col-span-2 text-center">NEW</div>
              <div className="col-span-2 text-center">QUOTED</div>
              <div className="col-span-2 text-center">ACTIVE</div>
              <div className="col-span-2 text-right">PIPELINE</div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[48rem] overflow-y-auto">
              {sorted.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
              {sorted.map(f => {
                const newInqs    = f.inquiries.filter(i => i.status === 'New')
                const quotedInqs = f.inquiries.filter(i => i.status === 'Quoted')
                const openState  = workloadOpen[f.id] || null
                const expandInqs = openState === 'New' ? newInqs : openState === 'Quoted' ? quotedInqs : openState === 'all' ? [...newInqs, ...quotedInqs] : []

                return (
                  <div key={f.id}>
                    {/* Row */}
                    <div className="grid grid-cols-12 gap-2 px-5 py-3 hover:bg-gray-50 transition-colors items-center">

                      {/* Name — click to toggle all active */}
                      <div className="col-span-4">
                        <button
                          onClick={() => toggleWorkload(f.id, 'all')}
                          className="text-left text-sm font-medium text-gray-800 hover:text-gray-600 flex items-center gap-1.5 w-full"
                        >
                          <span className="text-gray-300 text-[10px]" style={{ display:'inline-block', transform: openState === 'all' ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }}>▶</span>
                          <span className="truncate">{f.name}</span>
                        </button>
                      </div>

                      {/* New count — click to expand only New */}
                      <div className="col-span-2 text-center">
                        {newInqs.length > 0 ? (
                          <button
                            onClick={() => toggleWorkload(f.id, 'New')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                            style={{ background: openState === 'New' ? '#EEF2FF' : '#F3F4F6', color: openState === 'New' ? '#3730A3' : '#6B7280' }}
                          >
                            {newInqs.length} New
                          </button>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </div>

                      {/* Quoted count — click to expand only Quoted */}
                      <div className="col-span-2 text-center">
                        {quotedInqs.length > 0 ? (
                          <button
                            onClick={() => toggleWorkload(f.id, 'Quoted')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                            style={{ background: openState === 'Quoted' ? '#FFFBEB' : '#F3F4F6', color: openState === 'Quoted' ? '#92400E' : '#6B7280' }}
                          >
                            {quotedInqs.length} Quoted
                          </button>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </div>

                      {/* Total active */}
                      <div className="col-span-2 text-center">
                        <span className="text-sm font-semibold text-gray-700">{f.active}</span>
                      </div>

                      {/* Pipeline value */}
                      <div className="col-span-2 text-right">
                        <span className="text-sm text-gray-600">{f.pipeline > 0 ? fmtCr(f.pipeline) : '—'}</span>
                      </div>
                    </div>

                    {/* Expanded inquiries */}
                    {expandInqs.length > 0 && (
                      <div className="bg-gray-50 border-t border-gray-100 px-5 py-2 space-y-1.5">
                        {expandInqs.map(i => (
                          <div key={i.id} className="flex items-center justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-gray-800">{i.client_name}</span>
                              <span className="text-gray-400 mx-1.5">·</span>
                              <span className="text-gray-500 text-xs">{i.project_name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                              <Pill
                                bg={i.status === 'New' ? '#EEF2FF' : '#FFFBEB'}
                                color={i.status === 'New' ? '#3730A3' : '#92400E'}
                              >{i.status}</Pill>
                              <span className="text-xs font-medium text-emerald-700 w-16 text-right">
                                {i.project_value ? fmtCr(parseFloat(i.project_value)) : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── STALE INQUIRIES ── */}
      {tab === 'stale' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <span className="font-medium text-gray-900 text-sm">Stale Inquiries</span>
            <p className="text-[11px] text-gray-400 mt-0.5">No status change in 15+ days while still New or Quoted — nothing should be silently forgotten</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[36rem] overflow-y-auto">
            {staleInquiries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Nothing stale — everything is moving 👍</p>
            ) : staleInquiries.map(i => (
              <div key={i.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{i.client_name} <span className="text-gray-400 font-normal">— {i.project_name}</span></div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{getName(team, i.schueco_person_id)} · {getName(fabricators, i.fabricator_id)} · {getName(architects, i.architect_id)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Pill bg={i.days >= 30 ? '#FEF2F2' : '#FFFBEB'} color={i.days >= 30 ? '#B91C1C' : '#92400E'}>{i.days} days</Pill>
                  <Pill bg="#F3F4F6" color="#374151">{i.status}</Pill>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COMPARE ── */}
      {tab === 'compare' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex gap-2 mb-4">
              {['fabricator','architect'].map(t => (
                <button key={t} onClick={() => { setCompareType(t); setCompareAId(''); setCompareBId('') }}
                  className="px-3 py-1.5 text-xs rounded-md capitalize transition-all"
                  style={{ background: compareType === t ? '#0F0F0F' : '#F3F4F6', color: compareType === t ? '#fff' : '#6B7280' }}>
                  {t}s
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">FIRST {compareType.toUpperCase()}</label>
                <SearchableSelect options={compareType === 'fabricator' ? fabricators : architects} value={compareAId} onChange={setCompareAId} placeholder={`Select ${compareType}...`} />
              </div>
              <div>
                <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">SECOND {compareType.toUpperCase()}</label>
                <SearchableSelect options={compareType === 'fabricator' ? fabricators : architects} value={compareBId} onChange={setCompareBId} placeholder={`Select ${compareType}...`} />
              </div>
            </div>
          </div>

          {compareAId && compareBId && (() => {
            const list  = compareType === 'fabricator' ? fabStats : archStats
            const opts  = compareType === 'fabricator' ? fabricators : architects
            const a = list.find(x => x.id === compareAId) || { name: getName(opts, compareAId), total:0, active:0, won:0, lost:0, winRate:0, pipeline:0, wonVal:0 }
            const b = list.find(x => x.id === compareBId) || { name: getName(opts, compareBId), total:0, active:0, won:0, lost:0, winRate:0, pipeline:0, wonVal:0 }
            const rows = [
              { label: 'Total Inquiries', a: a.total, b: b.total },
              { label: 'Active', a: a.active, b: b.active },
              { label: 'Won', a: a.won, b: b.won },
              { label: 'Lost', a: a.lost, b: b.lost },
              { label: 'Win Rate', a: `${a.winRate}%`, b: `${b.winRate}%` },
              { label: 'Pipeline Value', a: fmtCr(a.pipeline), b: fmtCr(b.pipeline) },
              { label: 'Won Value', a: fmtCr(a.wonVal), b: fmtCr(b.wonVal) },
            ]
            return (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-gray-400 tracking-wider">METRIC</th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-gray-900">{a.name}</th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-gray-900">{b.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.label} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3 text-[11px] text-gray-400 tracking-wider">{r.label.toUpperCase()}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">{r.a}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">{r.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
