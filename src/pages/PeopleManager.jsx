import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const LISTS = [
  { title: 'Schueco Team',  table: 'schueco_team', icon: '◎', key: 'team' },
  { title: 'Fabricators',   table: 'fabricators',  icon: '⬡', key: 'fab'  },
  { title: 'Architects',    table: 'architects',   icon: '△', key: 'arch' },
]

export default function PeopleManager() {
  const [data, setData]       = useState({ team: [], fab: [], arch: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('schueco_team').select('*').order('name'),
      supabase.from('fabricators').select('*').order('name'),
      supabase.from('architects').select('*').order('name'),
    ]).then(([t, f, a]) => {
      setData({
        team: t.data || [],
        fab:  f.data || [],
        arch: a.data || [],
      })
      setLoading(false)
    })
  }, [])

  function updateList(key, updater) {
    setData(prev => ({ ...prev, [key]: updater(prev[key]) }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-xl font-medium text-gray-900">Manage People</h1>
        <p className="text-sm text-gray-500 mt-1">Add or remove names from each stakeholder list.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {LISTS.map(cfg => (
          <PeopleCard
            key={cfg.key}
            {...cfg}
            list={data[cfg.key]}
            onUpdate={updater => updateList(cfg.key, updater)}
          />
        ))}
      </div>
    </div>
  )
}

function PeopleCard({ title, table, icon, list, onUpdate }) {
  const [input,  setInput]  = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    const name = input.trim()
    if (!name) return
    if (list.find(x => x.name.toLowerCase() === name.toLowerCase())) {
      setInput('')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.from(table).insert({ name }).select().single()
    if (data) onUpdate(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    if (error) alert('Failed to add. Please try again.')
    setInput('')
    setSaving(false)
  }

  async function remove(id, name) {
    if (!window.confirm(`Remove "${name}" from ${title}?`)) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { alert('Failed to remove. They may be assigned to an active inquiry.'); return }
    onUpdate(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <span className="text-base" style={{ color: '#C9A44A' }}>{icon}</span>
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5">
          {list.length}
        </span>
      </div>

      {/* Add input */}
      <div className="p-3">
        <div className="flex gap-2 mb-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && add()}
            placeholder="Add name..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 transition-colors"
          />
          <button
            onClick={add}
            disabled={saving || !input.trim()}
            className="w-8 h-8 text-white rounded-lg flex items-center justify-center text-xl font-light disabled:opacity-40 transition-opacity hover:opacity-80"
            style={{ background: '#0F0F0F' }}
          >
            +
          </button>
        </div>

        {/* List */}
        <div className="max-h-60 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-5">No names added yet</p>
          ) : (
            list.map(x => (
              <div
                key={x.id}
                className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-sm text-gray-700">{x.name}</span>
                <button
                  onClick={() => remove(x.id, x.name)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors ml-2 flex-shrink-0"
                  title={`Remove ${x.name}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
