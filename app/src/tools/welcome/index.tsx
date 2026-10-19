import { Sparkles } from 'lucide-react';
import { defineTool } from '../../plugin-api';
import { classicEditorUrl } from '../../shell/classic';

function Welcome() {
  return (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-pixel text-[10px] tracking-widest text-chili">PREVIEW</p>
        <h1 className="font-display text-2xl font-bold">The new Chili Creator</h1>
        <p className="text-muted leading-relaxed">
          This is the start of the new game creator. Rooms, painting, dialog and play-testing
          arrive here tool by tool. Until then, make your games in the classic editor.
        </p>
        <p>
          <a className="text-phosphor underline-offset-4 hover:underline" href={classicEditorUrl()}>
            Open the classic editor
          </a>
        </p>
      </div>
    </div>
  );
}

export default defineTool({
  id: 'welcome',
  title: 'Start',
  icon: Sparkles,
  component: Welcome,
  defaultPosition: 'center',
  openByDefault: true,
});
