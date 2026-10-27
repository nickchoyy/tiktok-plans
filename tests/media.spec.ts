import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareMedia } from '../src/lib/server/media';
test('permitted local video produces bounded visual frames and corrupt content is rejected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plans-media-test-'));
  try {
    await promisify(execFile)(
      'ffmpeg',
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=purple:s=320x240:r=5',
        '-t',
        '2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        join(dir, 'sample.mp4'),
      ],
      { timeout: 15000 },
    );
    const media = await prepareMedia(await readFile(join(dir, 'sample.mp4')));
    expect(media.frames.length).toBeGreaterThan(0);
    expect(media.frames.length).toBeLessThanOrEqual(4);
    expect(media.audio).toBeNull();
    expect(media.frames[0].subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    await expect(prepareMedia(Buffer.from('#EXTM3U\nhttps://example.com/remote'))).rejects.toThrow(
      'Playlists',
    );
    await expect(prepareMedia(Buffer.alloc(13 * 1024 * 1024))).rejects.toThrow('12 MB');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
