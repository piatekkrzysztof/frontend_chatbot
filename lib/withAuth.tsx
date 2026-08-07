'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function withAuth<T extends object>(Component: React.ComponentType<T>) {
  return function ProtectedComponent(props: T) {
    const router = useRouter();

    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) router.replace('/login');
    }, [router]);

    return <Component {...props} />;
  };
}
