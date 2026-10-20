/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API běží samostatně (apps/api); web je čistě klientský vůči REST API.
  env: {},
};

export default nextConfig;
