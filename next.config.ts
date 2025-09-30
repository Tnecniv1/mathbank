import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ❌ on enlève "output: 'export'" pour garder un serveur Next
  images: { unoptimized: true },

  // Laisse le build passer même si ESLint/TS râlent (pratique pour déployer vite)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
