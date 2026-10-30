import { AlertTriangle, CircleCheck, Info, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { defineTool } from '../../../plugin-api';
import { Empty } from '../../../tools/shared';
import { checkGame } from '../check';
import { useGame } from '../state';

const icons = { error: XCircle, warning: AlertTriangle, info: Info };
const colours = { error: 'text-chili', warning: 'text-amber', info: 'text-muted' };

function Problems() {
  const game = useGame();
  const problems = useMemo(() => (game ? checkGame(game) : []), [game]);
  if (!game) return <Empty icon={<AlertTriangle />}>Open a Chili Beat game to check it.</Empty>;
  if (!problems.length) return <Empty icon={<CircleCheck />}>No problems found.</Empty>;
  return (
    <ul aria-label="Problems" className="space-y-1 overflow-auto p-3 text-xs">
      {problems.map((problem, i) => {
        const Icon = icons[problem.severity];
        return (
          <li key={i} className="flex items-start gap-2">
            <Icon className={`mt-0.5 size-4 shrink-0 ${colours[problem.severity]}`} aria-label={problem.severity} />
            <span>{problem.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default defineTool({
  id: 'beat-problems',
  title: 'Problems',
  icon: AlertTriangle,
  help: 'Mistakes that stop the game from playing, things that may not work as you expect, and notes.',
  component: Problems,
  defaultPosition: 'within',
  defaultReference: 'beat-play',
  openByDefault: true,
  openInBackground: true,
});
