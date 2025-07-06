import path from 'path'
import type { NextConfig } from 'next'
import type { Configuration as WebpackConfig } from 'webpack'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/oauth2/authorization/:provider',
        destination: 'http://localhost:8080/oauth2/authorization/:provider',
      },
      {
        source: '/login/oauth2/code/:provider',
        destination: 'http://localhost:8080/login/oauth2/code/:provider',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ]
  },
  webpack(config: WebpackConfig, options) {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return config
  },
}

export default nextConfig