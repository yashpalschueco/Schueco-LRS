import { useState, useRef, useEffect } from 'react'

// Must be defined at module level — never inside another component
export default function SearchableSelect({ options, value, onChange, placeholder }) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef(null)
  const inputRef            = useRef(null)

  const selected = options.find(o => o.id === value)
  const filtered = query
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function onOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function openDropdown() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function select(id) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg text-left flex justify-between items-center bg-white outline-none focus:border-gray-400 transition-colors"
        style={{ color: selected ? '#111827' : '#9CA3AF', cursor: 'pointer' }}
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <span className="text-gray-300 text-[10px] ml-2 flex-shrink-0">▼</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={{ top: 'calc(100% + 4px)', zIndex: 100 }}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-gray-400"
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {value && (
              <div
                onClick={() => select('')}
                className="px-3.5 py-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
              >
                Clear selection
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-3.5 py-3 text-sm text-gray-400 text-center">No matches found</div>
            ) : (
              filtered.map(o => (
                <div
                  key={o.id}
                  onClick={() => select(o.id)}
                  className="px-3.5 py-2.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{
                    background: o.id === value ? '#F9FAFB' : undefined,
                    fontWeight: o.id === value ? 500 : 400,
                    color: '#374151',
                  }}
                >
                  {o.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
