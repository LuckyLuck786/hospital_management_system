import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/shared/query-provider';

export const metadata: Metadata = {
  title: { default: 'MedCore HMS — Hospital Management Platform', template: '%s · MedCore HMS' },
  description:
    'Multi-tenant hospital management: appointments, EMR, e-prescriptions, laboratory, pharmacy, wards and billing in one secure platform.',
  icons: { icon: '/icon.svg' },
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
