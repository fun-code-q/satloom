/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/satloom',
  images: {
    unoptimized: true,
  },
  devIndicators: false,
}

export default nextConfig
