'use client'

import { useEffect, useRef } from 'react'
import { uploadError, uploadRules, type UploadKind } from '@/lib/uploads'

export default function UploadField({ id, label, kind, file, onChange, disabled = false }: {
  id: string
  label: string
  kind: UploadKind
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const error = uploadError(file, kind)
  useEffect(() => {
    if (!file && input.current) input.current.value = ''
  }, [file])

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">{label}</label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={uploadRules[kind].accept}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        className="text-sm w-full"
      />
      <p id={`${id}-hint`} className="text-xs tekst-drugi mt-2 max-w-xl">
        {uploadRules[kind].hint}
      </p>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-[#c0392b] mt-2">{error}</p>}
    </div>
  )
}
