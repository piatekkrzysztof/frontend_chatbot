import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Ścieżki wymagające zalogowania
const protectedPaths = ['/dashboard', '/documents', '/users', '/faq', '/conversations']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}
