import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_UPLOAD_BYTES } from '../imports';
import { ServiceError } from './errors';
const run = promisify(execFile);
let mediaTools: Promise<boolean> | undefined;
async function checkMediaTools() {
  try {
    await Promise.all(
      ['ffmpeg', 'ffprobe'].map((tool) =>
        run(tool, ['-version'], { timeout: 3000, maxBuffer: 16384 }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
export function hasMediaTools() {
  return (mediaTools ??= checkMediaTools());
}
export async function prepareMedia(bytes: Buffer) {
  if (bytes.length > MAX_UPLOAD_BYTES)
    throw new ServiceError('TOO_LARGE', 'Videos must be 12 MB or smaller.', 413);
  const mp4 = bytes.subarray(4, 8).toString() === 'ftyp';
  const webm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!mp4 && !webm)
    throw new ServiceError(
      'UNSUPPORTED_VIDEO',
      'Use an MP4, MOV, or WebM video. Playlists and remote media references are not accepted.',
    );
  const dir = await mkdtemp(join(tmpdir(), 'plans-media-'));
  try {
    const input = join(dir, mp4 ? 'input.mp4' : 'input.webm');
    await writeFile(input, bytes, { mode: 0o600 });
    let metadata;
    try {
      const probe = await run(
        'ffprobe',
        [
          '-v',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-show_format',
          '-show_streams',
          '-of',
          'json',
          input,
        ],
        { timeout: 10000, maxBuffer: 65536 },
      );
      metadata = JSON.parse(probe.stdout);
    } catch {
      throw new ServiceError(
        'INVALID_VIDEO',
        'This video could not be decoded. Try an MP4, MOV, or WebM file, or paste a transcript.',
      );
    }
    const duration = Number(metadata.format?.duration);
    const streams = metadata.streams as { codec_type: string; width?: number; height?: number }[];
    if (!Number.isFinite(duration) || duration <= 0 || duration > 90)
      throw new ServiceError(
        'VIDEO_DURATION',
        'Videos must be between 1 and 90 seconds. Trim the file or paste a transcript.',
      );
    const video = streams.find((s) => s.codec_type === 'video');
    if (!video || Math.max(video.width || 0, video.height || 0) > 4096)
      throw new ServiceError(
        'VIDEO_DIMENSIONS',
        'Use a video with a video track and dimensions no larger than 4096 pixels.',
      );
    await run(
      'ffmpeg',
      [
        '-v',
        'error',
        '-threads',
        '1',
        '-protocol_whitelist',
        'file,pipe',
        '-i',
        input,
        '-t',
        '90',
        '-vf',
        `fps=1/${Math.max(1, duration / 4)},scale=512:512:force_original_aspect_ratio=decrease`,
        '-frames:v',
        '4',
        '-threads',
        '1',
        join(dir, 'frame-%02d.jpg'),
      ],
      { timeout: 45000, maxBuffer: 65536 },
    );
    let audio: Buffer | null = null;
    if (streams.some((s) => s.codec_type === 'audio')) {
      await run(
        'ffmpeg',
        [
          '-v',
          'error',
          '-threads',
          '1',
          '-protocol_whitelist',
          'file,pipe',
          '-i',
          input,
          '-t',
          '90',
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          join(dir, 'audio.wav'),
        ],
        { timeout: 30000, maxBuffer: 65536 },
      );
      audio = await readFile(join(dir, 'audio.wav'));
    }
    const frames = await Promise.all(
      (await readdir(dir))
        .filter((f) => /^frame-\d+\.jpg$/.test(f))
        .slice(0, 4)
        .map((f) => readFile(join(dir, f))),
    );
    if (!frames.length)
      throw new ServiceError(
        'NO_FRAMES',
        'No usable visual frames were found. Add a description instead.',
      );
    return { frames, audio, duration };
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError(
      'MEDIA_PROCESSING_FAILED',
      'Video processing failed or timed out. Trim the file or add a transcript.',
      422,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
