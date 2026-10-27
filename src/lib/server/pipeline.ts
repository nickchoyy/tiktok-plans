import type { Extraction, ProcessResult, VerificationResult } from '../library-types';
import { extractContent, transcribe } from './openai';
import { verifyExtraction } from './google-places';
import { prepareMedia } from './media';
export interface PipelineAdapters {
  extract: (context: string, frames?: Buffer[]) => Promise<Extraction>;
  verify: (extraction: Extraction) => Promise<VerificationResult>;
  transcribe: (audio: Buffer) => Promise<string>;
}
const defaults: PipelineAdapters = {
  extract: extractContent,
  verify: verifyExtraction,
  transcribe,
};
export async function processContent(
  input: { context: string; video?: Buffer },
  adapters: PipelineAdapters = defaults,
): Promise<ProcessResult> {
  let context = input.context.trim();
  let frames: Buffer[] = [];
  if (input.video) {
    const media = await prepareMedia(input.video);
    frames = media.frames;
    if (media.audio) context += '\nVideo transcript: ' + (await adapters.transcribe(media.audio));
  }
  if (!context && !frames.length)
    return {
      extraction: null,
      state: 'needs_review',
      verification: 'unverified',
      googlePlaceId: null,
      matches: [],
      message:
        'A TikTok link alone does not reveal its content. Add a description, transcript, or permitted video file so AI can identify the place.',
    };
  const extraction = await adapters.extract(context, frames);
  if (
    !extraction.name ||
    !extraction.city ||
    extraction.confidence < 0.6 ||
    extraction.missingInfo.some((m) => /multiple (places|venues)/i.test(m))
  )
    return {
      extraction,
      state: 'needs_review',
      verification: 'unverified',
      googlePlaceId: null,
      matches: [],
      message:
        'AI needs your help with the place name, city, or uncertain details. Review and save corrections to verify.',
    };
  try {
    const result = await adapters.verify(extraction);
    return { ...result, extraction, state: result.googlePlaceId ? 'ready' : 'needs_review' };
  } catch {
    return {
      extraction,
      state: 'needs_review',
      verification: 'unavailable',
      googlePlaceId: null,
      matches: [],
      message:
        'AI extraction succeeded, but Google verification is unavailable. Your extracted details are saved. Retry verification after checking the Google configuration.',
    };
  }
}
