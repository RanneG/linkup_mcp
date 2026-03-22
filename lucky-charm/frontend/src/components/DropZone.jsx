import { useState, useRef } from 'react'
import './DropZone.css'

export default function DropZone({ onFiles, disabled, hasFiles, fileCount = 0 }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  const accept = '.tab,.tsv,text/tab-separated-values,text/plain'
  const validate = (f) => f && (f.name.endsWith('.tab') || f.name.endsWith('.tsv') || f.type.includes('text'))

  const sendFiles = (fileList) => {
    if (!fileList || !onFiles) return
    const arr = Array.from(fileList || []).filter(validate)
    if (arr.length > 0) onFiles(arr)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    if (disabled) return
    sendFiles(e.dataTransfer?.files)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    if (disabled) return
    setDrag(true)
  }

  const onDragLeave = () => setDrag(false)

  const onBrowse = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onInputChange = (e) => {
    sendFiles(e.target?.files)
    e.target.value = ''
  }

  const count = fileCount || (hasFiles ? 1 : 0)
  return (
    <div
      className={`dropzone ${drag ? 'dropzone--drag' : ''} ${hasFiles ? 'dropzone--has-file' : ''} ${disabled ? 'dropzone--disabled' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={onInputChange}
        className="dropzone-input"
        aria-label="Choose transcript files"
      />
      <p className="dropzone-text">
        {hasFiles
          ? count > 1
            ? `${count} files selected — see preview below`
            : 'File selected — see preview below'
          : 'Drag transcripts here or click to browse'}
      </p>
      <button
        type="button"
        className="dropzone-browse"
        onClick={onBrowse}
        disabled={disabled}
      >
        {hasFiles ? 'Choose different files' : 'Browse'}
      </button>
    </div>
  )
}
