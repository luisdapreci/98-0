import type { Metadata } from 'next';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: '98-0 | The Draft Room',
  description: 'Six picks. Seven decades. Build your all-time NBA lineup.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
