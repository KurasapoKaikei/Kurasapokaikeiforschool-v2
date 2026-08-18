
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ECS Fargate 上で `node server.js` として動かすための自己完結出力。
  // ビルド成果物は .next/standalone に出る（Dockerfile 参照）。
  output: 'standalone',
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/club/dashboard", permanent: false },
      { source: "/guide", destination: "/club/guide", permanent: false },
      { source: "/accounting/:path*", destination: "/club/accounting/:path*", permanent: false },
      { source: "/collection/:path*", destination: "/club/collection/:path*", permanent: false },
      { source: "/members/:path*", destination: "/club/members/:path*", permanent: false },
      { source: "/settings/:path*", destination: "/club/settings/:path*", permanent: false },
      { source: "/budget/:path*", destination: "/club/budget/:path*", permanent: false },
    ]
  },
}

module.exports = nextConfig
