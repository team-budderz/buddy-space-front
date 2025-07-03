import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname, method } = request.nextUrl
  if (!pathname.startsWith('/api')) return NextResponse.next()

  const origin = request.headers.get('origin') || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const response = NextResponse.next()
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
