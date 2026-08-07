'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/documents', label: 'Dokumenty' },
  { href: '/faq', label: 'FAQ' },
  { href: '/widget-settings', label: 'Widget' },
  { href: '/conversations', label: 'Konwersacje' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white min-h-screen p-4">
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-2 text-sm font-medium ${
                active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
