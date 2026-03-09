import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/satloom',
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  turbopack: {},
}

export default withPWA(nextConfig)
