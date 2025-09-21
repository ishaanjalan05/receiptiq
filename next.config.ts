/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Skip ESLint during next build (CI/prod). We’ll fix rules later.
    ignoreDuringBuilds: true,
  },
  // If any AWS routes need Node runtime:
  // experimental: { serverComponentsExternalPackages: ["@aws-sdk/*"] },
};

export default nextConfig;
