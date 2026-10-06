import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import type { SidebarFooterProps } from './types';

const LINK =
  'rounded-tag text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function SidebarFooter({ dataDirs, version, credit }: SidebarFooterProps) {
  // One folder reads as just the path; several get their platform name.
  const labelled = dataDirs.length > 1;
  const update =
    version?.updateAvailable && version.latest ? (
      <Badge tone="info" title={`Version ${version.latest} is available`}>
        Update available
      </Badge>
    ) : null;

  return (
    <div className="-mt-3 flex flex-none flex-col gap-1 border-t border-line px-2 pt-3">
      {dataDirs.map((dir) => (
        <span
          key={`${dir.label}:${dir.path}`}
          title={`${dir.label} data: ${dir.path}`}
          className="truncate font-mono text-mono text-fg-subtle"
        >
          {labelled ? `${dir.label} ` : null}
          {dir.path}
        </span>
      ))}
      <div className="flex min-h-4 min-w-0 items-center gap-2 text-caption text-fg-subtle">
        {version?.current ? <span className="whitespace-nowrap">v{version.current}</span> : null}
        {update && version?.changelogUrl ? (
          <a href={version.changelogUrl} target="_blank" rel="noreferrer" className={LINK}>
            {update}
          </a>
        ) : (
          update
        )}
      </div>
      {credit || version?.repoUrl ? (
        <p className="truncate text-caption text-fg-subtle">
          {credit ? (
            <>
              Built by{' '}
              <a href={credit.href} target="_blank" rel="noreferrer" className={LINK}>
                {credit.name}
              </a>
            </>
          ) : null}
          {credit && version?.repoUrl ? ' · ' : null}
          {version?.repoUrl ? (
            <a href={version.repoUrl} target="_blank" rel="noreferrer" className={LINK}>
              GitHub
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
