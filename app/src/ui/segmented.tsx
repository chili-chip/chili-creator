import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Shown in the tooltip, like a shortcut key. */
  hint?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange(value: T): void;
  /** Hide the labels and show only icons. */
  compact?: boolean;
}

/** One choice out of a few, like a tool or a tab. */
export function Segmented<T extends string>({ label, value, options, onChange, compact }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-bg-0 p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.hint ? `${option.label} (${option.hint})` : option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs whitespace-nowrap text-muted transition-colors hover:text-text [&_svg]:size-4',
              checked && 'bg-bg-3 text-text shadow-[inset_0_0_0_1px_var(--color-line)]',
            )}
          >
            {Icon && <Icon aria-hidden />}
            {!(compact && Icon) && option.label}
          </button>
        );
      })}
    </div>
  );
}
