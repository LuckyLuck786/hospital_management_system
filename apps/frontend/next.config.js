/** @type {import('next').NextConfig} */
const nextConfig = {
  // In Docker the API container is reachable at http://api:3001; locally it is
  // localhost:3001. Make it explicit so the same build works in both worlds.
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
  // Self-contained server output for the production Docker image.
  // Opt-in via env because standalone output needs symlink support (Linux in
  // Docker; Windows blocks it without Developer Mode).
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
};
module.exports = nextConfig;
