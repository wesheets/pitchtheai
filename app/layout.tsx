import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://pitchtheai.com'),
  title: 'Pitch The AI — Four minds. One deal.',
  description:
    'Pitch your idea to four AI judges. Lose their patience, win a bidding war, and climb the public pitch board.',
  openGraph: {
    title: 'Pitch The AI — Make them lean in.',
    description:
      'Pitch your idea to four AI judges. Answer tough questions, defend your vision, and win the deal—or get roasted.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pitch The AI — Make them lean in.',
    description:
      'Pitch your idea to four AI judges. Answer tough questions, defend your vision, and win the deal—or get roasted.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
