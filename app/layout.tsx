import type {Metadata} from 'next';
import { Lora, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ArchPrompt — System Architecture Visualizer',
  description: 'AI-Powered System Architecture designer with interactive diagrams and draw.io exports.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${lora.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased bg-[#0A0A0A] text-[#F0F0F0]" suppressHydrationWarning>{children}</body>
    </html>
  );
}
