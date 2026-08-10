// app/(auth)/layout.tsx
import { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-espresso-700">
      <div className="w-full max-w-md bg-espresso-800 p-6 rounded-lg shadow">
        {children}
      </div>
    </main>
  )
}
