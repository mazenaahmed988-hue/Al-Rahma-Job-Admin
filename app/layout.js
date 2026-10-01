import './globals.css';

export const metadata = { title: 'لوحة إدارة الرحمة', description: 'بوابة إدارة فريق الرحمة للتوظيف' };
export default function RootLayout({ children }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
