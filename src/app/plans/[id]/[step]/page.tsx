import { PlanWorkspace } from '@/components/plan-workspace';
export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string; step: string }>;
}) {
  const { id, step } = await params;
  return <PlanWorkspace id={id} step={step} />;
}
