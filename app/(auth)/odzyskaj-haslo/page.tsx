import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import PasswordResetRequest from '@/components/auth/PasswordResetRequest'

export default function RecoverPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-7"><Logo wysokosc={30} jakoLink /></div>
      <h1 className="text-3xl mb-4">Nie pamiętasz hasła?</h1>
      <p className="tekst-drugi mb-6">Podaj adres używany do logowania. Pomożemy Ci ustawić nowe hasło.</p>
      <PasswordResetRequest />
      <Link href="/login?wygasla=1" className="underline inline-flex items-center min-h-11 mt-5">Wróć do logowania</Link>
    </div>
  )
}
