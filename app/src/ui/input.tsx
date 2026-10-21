import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from './cn';

const field =
  'h-8 min-w-0 rounded-md border border-line bg-bg-0 px-2 text-xs text-text hover:border-muted/60 focus:border-phosphor focus:outline-none disabled:opacity-50';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, 'pr-6', className)} {...props} />;
}

/** A labelled checkbox. */
export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-xs text-text', className)}>
      <input type="checkbox" className="size-4 accent-chili" {...props} />
      {label}
    </label>
  );
}
