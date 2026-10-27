'use client';
import { useState } from 'react';
import { ArrowUpRight, FileVideo, Link2, Plus, Upload, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { useLibrary } from './library-provider';
import { MAX_BATCH, MAX_UPLOAD_BYTES, normalizeTikTokUrl } from '@/lib/imports';
export function ImportPlacesButton({
  variant = 'default',
  className,
  children,
}: {
  variant?: 'default' | 'lime' | 'outline' | 'secondary';
  className?: string;
  children?: React.ReactNode;
}) {
  const { importItems, capabilities } = useLibrary();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState('');
  const [context, setContext] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (files.length && !permission)
        throw new Error('Confirm that you have permission to process the selected videos.');
      if (files.some((f) => f.size > MAX_UPLOAD_BYTES))
        throw new Error('Each video must be 12 MB or smaller.');
      const lines = links
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const items = lines.map((line) => {
        const [url, ...description] = line.split('|');
        return {
          sourceUrl: normalizeTikTokUrl(url),
          context: description.join('|').trim() || context,
        };
      });
      for (const file of files)
        items.push({ sourceUrl: '', context, file } as (typeof items)[number] & { file: File });
      const descriptions =
        !lines.length && !files.length
          ? context
              .split(/\n\s*\n/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      for (const text of descriptions) items.push({ sourceUrl: '', context: text });
      if (!items.length) throw new Error('Add a link, description, transcript, or video first.');
      if (items.length > MAX_BATCH) throw new Error(`Collect up to ${MAX_BATCH} items per import.`);
      setBusy(true);
      const result = await importItems(items);
      if (!result.added && !result.updated) {
        setError(
          `Already collected: ${result.duplicates} duplicate ${result.duplicates === 1 ? 'item' : 'items'}. Open the existing place to add context.`,
        );
        return;
      }
      setOpen(false);
      setLinks('');
      setContext('');
      setFiles([]);
      setPermission(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import could not be added.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Plus size={16} />
          {children || 'Collect a place'}
        </Button>
      </DialogTrigger>
      <DialogContent className="import-dialog">
        <span className="dialog-icon">
          <Sparkles size={24} />
        </span>
        <DialogTitle className="text-2xl font-semibold tracking-tight">
          Save it once. Go when you’re ready.
        </DialogTitle>
        <DialogDescription className="mt-2 mb-6 text-sm text-muted leading-relaxed">
          Drop in a few links, tell us what caught your eye, or upload a video you can process. No
          plan needed.
        </DialogDescription>
        <form onSubmit={submit}>
          <label htmlFor="import-links" className="field-label">
            <Link2 size={14} />
            TikTok links <span className="optional-label">optional · one per line</span>
          </label>
          <textarea
            id="import-links"
            rows={3}
            className="field textarea"
            value={links}
            maxLength={22000}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={'https://www.tiktok.com/@creator/video/123…\nhttps://vm.tiktok.com/…'}
          />
          <p className="field-help">
            For different videos, add “ | description” after each link. Tracking parameters are
            removed for duplicate detection.
          </p>
          <label htmlFor="import-context" className="field-label mt-5">
            Description or transcript
          </label>
          <textarea
            id="import-context"
            rows={4}
            className="field textarea"
            maxLength={12000}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. This video shows [business name] in [city], a [type of experience]. A visit costs [amount and currency]…"
          />
          <p className="field-help">
            Context applies to every link without its own description. With no links, separate
            different experiences with a blank line. Bare links will ask for context; we don’t read
            private TikTok data.
          </p>
          <label htmlFor="import-videos" className="upload-zone mt-5">
            <FileVideo size={23} />
            <span>
              <b>
                {files.length
                  ? `${files.length} ${files.length === 1 ? 'video' : 'videos'} selected`
                  : 'Or bring a video'}
              </b>
              <small>MP4, MOV, WebM · 12 MB & 90 sec max · up to 3 files</small>
            </span>
            <Upload size={17} />
            <input
              id="import-videos"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              multiple
              disabled={capabilities?.video === false}
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (selected.length > 3) {
                  setError('Select up to 3 videos per import.');
                  e.target.value = '';
                  return;
                }
                setFiles(selected);
              }}
            />
          </label>
          {capabilities?.video === false && (
            <p className="field-help">
              Video processing isn’t available on this server. Add a description or transcript
              instead.
            </p>
          )}
          {files.length > 0 && (
            <>
              <p className="field-help">{files.map((f) => f.name).join(', ')}</p>
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                />
                <span>
                  I own or have permission to process these videos. Audio and up to four frames will
                  be sent to OpenAI. Originals are not retained on the server.
                </span>
              </label>
            </>
          )}
          <div className="import-footer">
            <span>
              <Sparkles size={14} />
              AI organizes automatically
            </span>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="button-spinner" />
                  Collecting…
                </>
              ) : (
                <>
                  Add to My Places <ArrowUpRight size={15} />
                </>
              )}
            </Button>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </form>
        <p className="import-fineprint">
          Public links and your own content only. TikTok Favorites, private videos, native sharing,
          and background account access are not connected.
        </p>
      </DialogContent>
    </Dialog>
  );
}
