/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your configuration options here
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['www.opensecrets.org'],
  },
};

module.exports = nextConfig; 