import { Download as DownloadIcon, FileCode2, FileText, Film } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { download, fileName } from '../../export/files';
import { exportHtml, loadHtmlParts } from '../../export/html';
import { defineTool } from '../../plugin-api';
import { useCreator, useWorld } from '../../shell/creator-context';
import { Button } from '../../ui/button';
import { Input, Select } from '../../ui/input';
import { Empty } from '../shared';

const sizes = [
  { value: 'fill', label: 'Fill the window' },
  { value: '256', label: '256 pixels' },
  { value: '512', label: '512 pixels' },
  { value: '1024', label: '1024 pixels' },
];

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-md border border-line bg-bg-0 p-3">
      <h2 className="flex items-center gap-2 text-sm text-text [&_svg]:size-4">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Download() {
  const creator = useCreator();
  const world = useWorld();
  const [pageColor, setPageColor] = useState('#000000');
  const [size, setSize] = useState('fill');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!world) return <Empty icon={<DownloadIcon />}>Open a game to download it.</Empty>;
  const title = world.title.split('\n')[0] || 'game';

  async function webPage() {
    setBusy(true);
    setError('');
    try {
      const parts = await loadHtmlParts();
      const html = exportHtml({ data: creator.projects.data(), title, pageColor, size: size === 'fill' ? 'fill' : Number(size), ...parts });
      download(fileName(title, 'html'), html, 'text/html');
    } catch (err) {
      setError(`Could not make the page: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs text-muted">
      <Section icon={<FileText />} title="Game file">
        <p>The .bitsy file: open it in this creator, the Bitsy editor or a citsy console.</p>
        <Button size="sm" onClick={() => download(fileName(title, 'bitsy'), creator.projects.data(), 'text/plain')}>
          <DownloadIcon />
          Download .bitsy
        </Button>
      </Section>

      <Section icon={<FileCode2 />} title="Web page">
        <p>One page that plays the game in any browser, also offline. Put it on itch.io or any website.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            Page colour
            <Input type="color" aria-label="Page colour" value={pageColor} onChange={(event) => setPageColor(event.target.value)} className="w-12 p-0.5" />
          </label>
          <label className="flex items-center gap-2">
            Size
            <Select aria-label="Size" value={size} onChange={(event) => setSize(event.target.value)}>
              {sizes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <Button size="sm" onClick={() => void webPage()} disabled={busy}>
          <DownloadIcon />
          {busy ? 'Making the page…' : 'Download web page'}
        </Button>
        {error && (
          <p role="alert" className="text-chili">
            {error}
          </p>
        )}
      </Section>

      <Section icon={<Film />} title="GIF">
        <p>Record a GIF while you play: press Record in the Play tool.</p>
      </Section>
    </div>
  );
}

export default defineTool({
  id: 'download',
  title: 'Download',
  icon: DownloadIcon,
  component: Download,
  defaultPosition: 'within',
  defaultReference: 'game',
});
