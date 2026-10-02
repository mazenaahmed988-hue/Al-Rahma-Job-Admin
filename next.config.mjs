/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  turbopack: { root: import.meta.dirname },
  // فتح السيرفر لأجهزة الشبكة المحلية (LAN / نفس الواي فاي)
  // من غيرها Next.js بيسيب طلباتCross-origin زي HMR والجافاسكريبت,
  // والصفحة بتفتح بس مفيش أي JS بيشتغل (لا تسجيل دخول ولا تنقل).
  allowedDevOrigins: ['192.168.1.6', '192.168.1.2', '192.168.1.50', '192.168.1.51', '192.168.1.52', '192.168.1.53'],
};

export default nextConfig;
