/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 后端是独立的 FastAPI 服务（:8000），这里不做 rewrites，
  // 前端通过 NEXT_PUBLIC_API_BASE_URL 直连，认证走 Authorization: Bearer。
};

export default nextConfig;
