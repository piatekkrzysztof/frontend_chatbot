import { ReactNode } from 'react'

/**
 * Ekrany logowania i rejestracji. Bez karty na środku — pełne, ciemne tło
 * z poświatą trzyma ten sam nastrój co strona sprzedażowa, z której klient
 * właśnie przyszedł. Skok z ciepłego espresso na jasny prostokąt czytałby się
 * jak przejście do innego produktu.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-5 py-12">
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -top-40 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 62%)' }}
      />
      <div className="relative">{children}</div>
    </main>
  )
}
