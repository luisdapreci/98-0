import type { Metadata, Viewport } from 'next';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: '98-0. Basketball Across Generations',
  description: 'Six picks. Seven decades. Build your all-time NBA lineup.',
  applicationName: '98-0',
  appleWebApp: { capable: true, title: '98-0', statusBarStyle: 'default' },
  icons: { apple: [{ url: '/icon/180', sizes: '180x180', type: 'image/png' }] },
};

export const viewport: Viewport = { themeColor: '#131614' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
