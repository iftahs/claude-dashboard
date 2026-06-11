import type { SectionProps } from './types';

export function Section({ title, children, right, className = '', grow = false }: SectionProps) {
  return (
    <div className={`card p-5 ${grow ? 'flex flex-col h-full' : ''} ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {right}
      </div>
      <div className={grow ? 'flex-1 flex flex-col justify-end' : ''}>{children}</div>
    </div>
  );
}
