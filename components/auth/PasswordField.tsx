'use client'

import { useState } from 'react'

type Props = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  describedBy?: string
  invalid?: boolean
}

export default function PasswordField({ id, label, value, onChange, autoComplete, describedBy, invalid }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex gap-2 items-center">
        <input id={id} type={visible ? 'text' : 'password'} className="input min-w-0"
          required maxLength={1024} minLength={autoComplete === 'new-password' ? 8 : undefined}
          autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)}
          aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        <button type="button" onClick={() => setVisible(!visible)}
          className="min-h-11 px-3 rounded border border-[color:var(--obramowanie-mocne)] text-sm shrink-0"
          aria-label={`${visible ? 'Ukryj' : 'Pokaż'} ${label.toLocaleLowerCase('pl')}`}
          aria-pressed={visible}>{visible ? 'Ukryj' : 'Pokaż'}</button>
      </div>
    </div>
  )
}
