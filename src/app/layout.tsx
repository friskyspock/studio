import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed from Geist for broader compatibility
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VocalLink AI', // Updated title
  description: 'Conversational AI with Speech-to-Text and Text-to-Speech capabilities.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
