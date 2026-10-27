import { z } from 'zod';
import { normalizeTikTokUrl, MAX_UPLOAD_BYTES } from '@/lib/imports';
import { boundedBody, guardRequest, jsonBody, withProcessingSlot } from '@/lib/server/guards';
import { errorResponse, ServiceError } from '@/lib/server/errors';
import { processContent } from '@/lib/server/pipeline';
import { hasMediaTools } from '@/lib/server/media';
import { aiConfigured } from '@/lib/server/openai';
export const runtime = 'nodejs';
export const maxDuration = 180;
const Input = z.object({
  sourceUrl: z.string().max(2000).default(''),
  context: z.string().max(12000).default(''),
});
export async function POST(request: Request) {
  try {
    guardRequest(request);
    return await withProcessingSlot(async () => {
      let context = '',
        video: Buffer | undefined;
      const contentType = request.headers.get('content-type') || '';
      if (contentType.startsWith('multipart/form-data')) {
        const bytes = await boundedBody(request, MAX_UPLOAD_BYTES + 65536);
        const form = await new Request(request.url, {
          method: 'POST',
          headers: { 'content-type': contentType },
          body: new Uint8Array(bytes),
        }).formData();
        if (form.get('permission') !== 'true')
          throw new ServiceError(
            'PERMISSION_REQUIRED',
            'Confirm that you own or have permission to process this video.',
          );
        const file = form.get('video');
        if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD_BYTES)
          throw new ServiceError('INVALID_UPLOAD', 'Choose a video of 12 MB or less.');
        if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type))
          throw new ServiceError('UNSUPPORTED_VIDEO', 'Upload an MP4, MOV, or WebM video.');
        context = z
          .string()
          .max(12000)
          .parse(form.get('context') || '');
        if (!(await hasMediaTools()))
          throw new ServiceError(
            'VIDEO_UNAVAILABLE',
            'Video processing is unavailable on this server. Add a description or transcript instead.',
            503,
          );
        if (!aiConfigured())
          throw new ServiceError(
            'AI_NOT_CONFIGURED',
            'Add PLANS_OPENAI_API_KEY on the server to transcribe audio and analyze video frames. Your import is saved.',
            503,
          );
        video = Buffer.from(await file.arrayBuffer());
      } else {
        const input = Input.parse(await jsonBody(request));
        if (input.sourceUrl) {
          try {
            normalizeTikTokUrl(input.sourceUrl);
          } catch {
            throw new ServiceError(
              'INVALID_LINK',
              'Only a valid HTTPS TikTok video or short link is supported.',
            );
          }
        }
        if (!input.sourceUrl && !input.context.trim())
          throw new ServiceError('EMPTY_INPUT', 'Add a link, description, or video.');
        context = input.context;
      }
      const result = await processContent({ context, video });
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (e) {
    return errorResponse(e);
  }
}
