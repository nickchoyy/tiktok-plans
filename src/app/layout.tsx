import type { Metadata } from 'next';
import './globals.css';
import { PlanProvider } from '@/components/plan-provider';
import { LibraryProvider } from '@/components/library-provider';
import { Shell } from '@/components/shell';
export const metadata: Metadata = {
  title: 'TikTok Plans — Less scrolling. More going.',
  description:
    'Turn saved inspiration into good days with your favorite people. An independent planning prototype.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlanProvider>
          <LibraryProvider>
            <Shell>{children}</Shell>
          </LibraryProvider>
        </PlanProvider>
      </body>
    </html>
  );
}
