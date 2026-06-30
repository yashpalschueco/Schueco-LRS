import { useRef } from 'react'

const MAX_FILES = 10
const MAX_SIZE_MB = 20

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// pendingFiles: File[] not yet uploaded (for new inquiry)
// existingFiles: [{id, file_name, file_size}] already uploaded (for edit)
// onAddPending(files), onRemovePending(index), onRemoveExisting(id)
export default function FileUploader({
  pendingFiles = [],
  existingFiles = [],
  onAddPending,
  onRemovePending,
  onRemoveExisting,
}) {
  const inputRef = useRef(null)
  const totalCount = pendingFiles.length + existingFiles.length

  function handleSelect(e) {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return

    const room = MAX_FILES - totalCount
    if (room <= 0) {
      alert(`You can attach a maximum of ${MAX_FILES} files.`)
      e.target.value = ''
      return
    }

    const tooBig = selected.find(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (tooBig) {
      alert(`"${tooBig.name}" is larger than ${MAX_SIZE_MB}MB. Please choose a smaller file.`)
      e.target.value = ''
      return
    }

    const toAdd = selected.slice(0, room)
    if (selected.length > room) {
      alert(`Only ${room} more file(s) can be added (max ${MAX_FILES} total). The first ${room} were added.`)
    }
    onAddPending(toAdd)
    e.target.value = ''
  }

  return (
    <div>
      <label className="block text-[10px] font-medium tracking-widest text-gray-400 mb-1.5">
        ATTACHMENTS <span className="normal-case tracking-normal font-normal text-gray-300">(optional, up to {MAX_FILES} files)</span>
      </label>

      {/* Existing files (edit mode) */}
      {existingFiles.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {existingFiles.map(f => (
            <div key={f.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-400">📎</span>
                <span className="text-gray-700 truncate">{f.file_name}</span>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{fmtSize(f.file_size)}</span>
              </div>
              <button type="button" onClick={() => onRemoveExisting(f.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 ml-2">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Pending files (not yet uploaded) */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {pendingFiles.map((f, idx) => (
            <div key={idx} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-500">📎</span>
                <span className="text-gray-700 truncate">{f.name}</span>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{fmtSize(f.size)}</span>
              </div>
              <button type="button" onClick={() => onRemovePending(idx)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 ml-2">×</button>
            </div>
          ))}
        </div>
      )}

      {totalCount < MAX_FILES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full px-3.5 py-2.5 text-sm border border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          + Add files ({totalCount}/{MAX_FILES})
        </button>
      )}
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleSelect} />
    </div>
  )
}
