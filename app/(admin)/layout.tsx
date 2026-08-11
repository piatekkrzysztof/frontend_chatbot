'use client'

import { ReactNode, useState } from 'react'

import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { withAuth } from '@/lib/withAuth'

/**
 * Szkielet panelu.
 *
 * Boczne menu ma stałą szerokość 240 px, co na telefonie zostawiało treści
 * 135 px — formularze i tabele nie miały gdzie się zmieścić. Poniżej 1024 px
 * menu chowa się więc za przyciskiem i wysuwa jako nakładka.
 */
function AdminLayout({ children }: { children: ReactNode }) {
  const [menuOtwarte, setMenuOtwarte] = useState(false)

  return (
    // Jasny motyw obejmuje cały panel. Strona sprzedażowa i widget zostają
    // ciemne: tam liczy się rozpoznawalność marki, tu czytelność przy dłuższej
    // pracy z tabelami i formularzami.
    <div className="motyw-jasny min-h-screen flex flex-col">
      <Navbar onToggleMenu={() => setMenuOtwarte((v) => !v)} menuOtwarte={menuOtwarte} />

      <div className="flex flex-1">
        {/* Stałe menu od dużych ekranów */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Nakładka na mniejszych — zamyka się kliknięciem w tło, bo na
            telefonie trafienie w krzyżyk bywa trudniejsze niż w resztę ekranu */}
        {menuOtwarte && (
          <>
            <button
              aria-label="Zamknij menu"
              onClick={() => setMenuOtwarte(false)}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(17,12,4,0.7)', backdropFilter: 'blur(2px)' }}
            />
            <div
              className="lg:hidden fixed left-0 top-[68px] bottom-0 z-50 overflow-y-auto"
              style={{ background: 'var(--tlo)' }}
              onClick={() => setMenuOtwarte(false)}
            >
              <Sidebar />
            </div>
          </>
        )}

        <main className="flex-1 min-w-0 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  )
}

export default withAuth(AdminLayout)
