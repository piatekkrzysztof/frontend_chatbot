import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, company_name: company }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || 'Registration failed');
      }

      router.push('/login');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-4 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Rejestracja Tenanta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Firma" className="w-full p-2 border rounded" required />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full p-2 border rounded" required />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Hasło" type="password" className="w-full p-2 border rounded" required />
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Zarejestruj</button>
      </form>
    </div>
  );
}
