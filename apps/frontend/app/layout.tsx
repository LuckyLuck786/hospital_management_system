import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/shared/query-provider';

export const metadata: Metadata = {
  title: 'MedCore HMS',
  description: 'Hospital Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
