import type { SidebarProps } from './types';

const faviconUrl = '/favicon.svg';

/** Left navigation rail: brand + the scanned dir + vertical tab nav + footer credits. */
export function Sidebar({ tabs, activeTab, onNavigate, claudeDir, version }: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-ink-900/60">
      <div className="px-4 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <img src={faviconUrl} alt="" className="h-7 w-7" />
          <h1 className="text-lg font-extrabold text-zinc-100">Claude Usage</h1>
        </div>
        {claudeDir && (
          <p className="mt-1.5 truncate font-mono text-[10px] text-zinc-600" title={claudeDir}>
            {claudeDir}
          </p>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 ${
              activeTab === t.id
                ? 'bg-ink-700 text-zinc-100 shadow-sm ring-1 ring-white/10'
                : 'text-zinc-500 hover:bg-ink-700/40 hover:text-zinc-300'
            }`}
          >
            {t.icon && (
              <span className="w-5 flex-none text-center text-base leading-none" aria-hidden>
                {t.icon}
              </span>
            )}
            <span className="flex-1 truncate">{t.label}</span>
            {t.badge}
          </button>
        ))}
      </nav>

      <footer className="border-t border-white/5 px-4 py-3 text-[11px] text-zinc-600">
        <p>
          Built by{' '}
          <a
            href="https://iftah.dev"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-zinc-400 transition-colors hover:text-clay-400"
          >
            Iftah Saar
          </a>
          {version?.current && (
            <span className="text-zinc-700"> · v{version.current}</span>
          )}
          {version?.repoUrl && (
            <>
              {' · '}
              <a
                href={version.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-zinc-400"
              >
                GitHub
              </a>
            </>
          )}
        </p>
      </footer>
    </aside>
  );
}
