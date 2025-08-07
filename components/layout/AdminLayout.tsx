import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import SidebarLink from './SidebarLink';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/widget', label: 'Widget' },
  { href: '/documents', label: 'Dokumenty' },
  { href: '/websites', label: 'Strony WWW' },
  { href: '/faq', label: 'FAQ' },
  { href: '/users', label: 'Użytkownicy' },
  { href: '/conversations', label: 'Konwersacje' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r shadow-sm p-4">
        <h1 className="text-xl font-bold mb-6">Chatbot Admin</h1>
        <nav className="flex flex-col space-y-2">
          {navLinks.map((link) => (
            <SidebarLink key={link.href} href={link.href} label={link.label} />
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
