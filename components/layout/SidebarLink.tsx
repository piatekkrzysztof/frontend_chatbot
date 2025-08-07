import Link from 'next/link';
import { useRouter } from 'next/router';

interface Props {
  href: string;
  label: string;
}

export default function SidebarLink({ href, label }: Props) {
  const router = useRouter();
  const isActive = router.pathname === href;

  return (
    <Link
      href={href}
      className={`p-2 rounded text-sm font-medium transition ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </Link>
  );
}
