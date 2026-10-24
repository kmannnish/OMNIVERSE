import type { Metadata } from 'next';
import './globals.css';
import { OmniverseCursor } from '../components/OmniverseCursor';

export const metadata: Metadata = {
  title: 'OMNIVERSE — All streams within one luminous space',
  description: 'Where infinite streams float like particles in pure light. Draw any video from the boundless expanse in its purest form.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#06070B] text-white selection:bg-[#F3E5AB] selection:text-black relative">
        <OmniverseCursor />
        {children}
      </body>
    </html>
  );
}
