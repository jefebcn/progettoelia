/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Il driver Postgres resta un modulo Node normale, non viene impacchettato.
    serverComponentsExternalPackages: ["pg"],
  },
};

export default nextConfig;
