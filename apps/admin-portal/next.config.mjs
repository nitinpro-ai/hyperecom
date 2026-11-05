/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` = slim production Docker image (infrastructure/kubernetes).
  // Separate auth realm (admin JWT) — RBAC guards land Step 4+.
  output: "standalone",
};

export default nextConfig;
