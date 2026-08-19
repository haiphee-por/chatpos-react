import type { NextConfig } from 'next'

const apiOrigin = process.env.CHATPOS_API_URL || 'http://127.0.0.1:3001'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/db/:path*',
        destination: `${apiOrigin}/api/db/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
