import React, { useMemo } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

type Props = {
  password: string
}

const REQS = [
  { id: 'len', label: 'Pelo menos 8 caracteres', test: (s: string) => s.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: (s: string) => /[A-Z]/.test(s) },
  { id: 'lower', label: 'Uma letra minúscula', test: (s: string) => /[a-z]/.test(s) },
  { id: 'digit', label: 'Um número', test: (s: string) => /[0-9]/.test(s) },
  { id: 'symbol', label: 'Um caractere especial (Ex: @, $, *, _)', test: (s: string) => /[^A-Za-z0-9]/.test(s) },
]

export function PasswordGuidelines({ password }: Props) {
  const results = useMemo(() => {
    return REQS.map((r) => ({ id: r.id, label: r.label, ok: r.test(password) }))
  }, [password])

  return (
    <div className="bg-gray-50 rounded-lg p-4 flex items-start" aria-live="polite">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">A senha deve conter:</p>
        <ul className="text-sm space-y-1">
          {results.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <span className="mt-1">
                {r.ok ? <CheckCircle className="size-4 text-green-600" /> : <XCircle className="size-4 text-gray-300" />}
              </span>
              <span className={r.ok ? 'text-green-700' : 'text-gray-600'}>{r.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default PasswordGuidelines
