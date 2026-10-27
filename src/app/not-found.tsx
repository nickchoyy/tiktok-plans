import Link from 'next/link';
import { EmptyState } from '@/components/shell';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <EmptyState
      title="A little off the beaten path."
      description="This page doesn’t exist. Your next good plan is waiting back in your space."
    >
      <Button asChild>
        <Link href="/">Back to your space</Link>
      </Button>
    </EmptyState>
  );
}
