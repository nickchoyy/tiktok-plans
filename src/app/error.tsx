'use client';
import Link from 'next/link';
import { EmptyState } from '@/components/shell';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="A small detour."
      description="This page couldn’t load. Your saved plans are still on this device. Give it another try."
    >
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to your space</Link>
        </Button>
      </div>
    </EmptyState>
  );
}
