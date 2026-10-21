import { AlertTriangle, CircleCheck, OctagonAlert } from 'lucide-react';
import { useMemo } from 'react';
import { problemSummary, validate } from '../../bitsy';
import { defineTool } from '../../plugin-api';
import { useWorld } from '../../shell/creator-context';
import { Empty, useGoTo } from '../shared';

function Problems() {
  const world = useWorld();
  const goTo = useGoTo();
  const problems = useMemo(() => (world ? validate(world) : []), [world]);
  if (!world) return <Empty icon={<CircleCheck />}>Open a game to check it for problems.</Empty>;
  if (!problems.length) {
    return (
      <Empty icon={<CircleCheck className="text-phosphor" />}>
        No problems found.
      </Empty>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-3">
      <p className="text-xs text-muted">{problemSummary(problems)}</p>
      <ul aria-label="Problems" className="space-y-1">
        {problems.map((problem, index) => {
          const Icon = problem.severity === 'error' ? OctagonAlert : AlertTriangle;
          return (
            <li key={index}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md border border-line bg-bg-0 px-2 py-1.5 text-left text-xs text-text hover:border-muted/60"
                onClick={() => goTo(problem.at)}
              >
                <Icon
                  className={problem.severity === 'error' ? 'mt-0.5 size-3.5 shrink-0 text-chili' : 'mt-0.5 size-3.5 shrink-0 text-amber'}
                  aria-label={problem.severity}
                />
                {problem.message}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default defineTool({
  id: 'problems',
  title: 'Problems',
  icon: AlertTriangle,
  component: Problems,
  defaultPosition: 'within',
  defaultReference: 'dialog',
  openByDefault: true,
  openInBackground: true,
});
