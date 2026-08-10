// app/(admin)/layout.tsx
'use client'

import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { withAuth } from '@/lib/withAuth'
import { ReactNode } from 'react'

function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-espresso-900">
          {children}
        </main>
      </div>
    </div>
  )
}

export default withAuth(AdminLayout)
