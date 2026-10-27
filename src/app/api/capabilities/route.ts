import { aiConfigured } from '@/lib/server/openai';
import { routesConfigured } from '@/lib/server/routes';
import { hasMediaTools } from '@/lib/server/media';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json(
    {
      ai: aiConfigured(),
      places: !!process.env.GOOGLE_MAPS_API_KEY,
      routes: routesConfigured(),
      maps: !!process.env.GOOGLE_MAPS_API_KEY && process.env.PLANS_ENABLE_STATIC_MAPS === 'true',
      video: await hasMediaTools(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
