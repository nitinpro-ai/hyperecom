/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` = slim production Docker image (infrastructure/kubernetes).
  // PWA manifest + service worker land in Step 5 (onboarding wizard sprint).
  output: "standalone",
};

export default nextConfig;
