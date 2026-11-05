/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` = slim production Docker images (infrastructure/kubernetes).
  // One build serves: apnacity.com (marketplace) · {city}.apnacity.com ·
  // {shop}.apnacity.com (storefronts) — host-based tenant resolution middleware
  // arrives in Step 4 (COMPLETE-BUILD-GUIDE M06). All hosts allowed for now.
  output: "standalone",
};

export default nextConfig;
