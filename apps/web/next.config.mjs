/** @type {import('next').NextConfig} */
const nextConfig = {
  // One build serves: apnacity.com (marketplace) · {city}.apnacity.com ·
  // {shop}.apnacity.com (storefronts) — host-based tenant resolution middleware
  // arrives in Step 4 (COMPLETE-BUILD-GUIDE M06). All hosts allowed for now.
  async rewrites() {
    return [];
  },
};

export default nextConfig;
