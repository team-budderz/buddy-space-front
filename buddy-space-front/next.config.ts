import path from 'path'
import type { NextConfig } from 'next'
import type { Configuration as WebpackConfig } from 'webpack'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_AUTH_BASE_URL: process.env.NEXT_PUBLIC_AUTH_BASE_URL,
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
    const authBase = process.env.NEXT_PUBLIC_AUTH_BASE_URL

    return [
      {
        source: '/oauth2/authorization/:provider',
        destination: `${authBase}/oauth2/authorization/:provider`,
      },
      {
        source: '/login/oauth2/code/:provider',
        destination: `${authBase}/login/oauth2/code/:provider`,
      },
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ]
  },
  webpack(config: WebpackConfig) {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return config
  },
}

export default nextConfig