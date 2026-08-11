'use client'

import { ReactNode, useState } from 'react'

import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { withAuth } from '@/lib/withAuth'

function AdminLayout({ children }: { children: ReactNode }) {
  const [menuOtwarte, setMenuOtwarte] = useState(false)

  return (
    <div className="motyw-jasny admin-shell">
      <div className="admin-sidebar-desktop">
        <Sidebar />
      </div>

      {menuOtwarte && (
        <>
          <button
            aria-label="Zamknij menu"
            onClick={() => setMenuOtwarte(false)}
            className="admin-menu-backdrop lg:hidden"
          />
          <div className="admin-sidebar-mobile lg:hidden" onClick={() => setMenuOtwarte(false)}>
            <Sidebar />
          </div>
        </>
      )}

      <div className="admin-workspace">
        <Navbar onToggleMenu={() => setMenuOtwarte((v) => !v)} menuOtwarte={menuOtwarte} />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}

export default withAuth(AdminLayout)
