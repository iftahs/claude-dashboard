import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Checkbox } from '@/components/design-system/atoms/Checkbox/Checkbox';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { SettingRow } from '@/components/design-system/atoms/SettingRow/SettingRow';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { Dialog } from '@/components/design-system/molecules/Dialog/Dialog';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { DataSettingsProps } from './types';
import { FORGET_DESCRIPTION, FORGET_TITLE, LINK_CLASS, RETRY_NOTE } from './utils';

export function DataSettings({ id, view, onForget, onTelemetryChange }: DataSettingsProps) {
  const [confirming, setConfirming] = useState(false);
  const archiveLineRef = useRef<HTMLParagraphElement>(null);
  const forgetPending = useRef(false);
  const { archive, folders, version } = view;

  useEffect(() => {
    if (archive.busy || !forgetPending.current) return;
    forgetPending.current = false;
    if (!archive.canForget && document.activeElement === document.body) archiveLineRef.current?.focus({ preventScroll: true });
  }, [archive.busy, archive.canForget]);

  return (
    <div id={id} className="scroll-mt-6">
      <Section title="Data" description="What the dashboard keeps, sends and reads">
        <div className="flex flex-col divide-y divide-line">
          <SettingRow
            title="History archive"
            description={
              <>
                Claude Code deletes its transcripts after about 30 days, and their usage leaves the charts with them. The archive keeps a
                slim copy of each deleted transcript&apos;s usage rows (never its text) in the dashboard&apos;s local cache, so long-range
                views keep that history. It is switched on in the server&apos;s environment, not here: start the dashboard with{' '}
                <code className="font-mono text-mono text-fg">DASHBOARD_RETAIN_HISTORY=1</code> (in Docker, set it in the container&apos;s
                environment).
              </>
            }
            below={
              <div aria-busy={archive.status === 'loading'} className="flex min-w-0 flex-col gap-2">
                {archive.status === 'loading' ? <Skeleton className="h-4 w-64 max-w-full" /> : null}
                {archive.status === 'error' ? (
                  <p className="text-small text-fg-muted">Could not read the archive status. {RETRY_NOTE}</p>
                ) : null}
                {archive.status === 'ready' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p
                      ref={archiveLineRef}
                      role="status"
                      tabIndex={-1}
                      className="min-w-0 rounded-tag text-small text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {archive.line}
                    </p>
                    {archive.canForget ? (
                      <Button
                        variant={archive.busy ? 'secondary' : 'danger'}
                        size="sm"
                        aria-disabled={archive.busy || undefined}
                        className={archive.busy ? 'cursor-progress text-fg-muted' : undefined}
                        onClick={archive.busy ? undefined : () => setConfirming(true)}
                      >
                        <Icon name="trash" size={14} />
                        {archive.busy ? 'Forgetting' : FORGET_TITLE}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {archive.error ? (
                  <p role="alert" className="text-caption text-danger-fg">
                    {archive.error}
                  </p>
                ) : null}
              </div>
            }
          >
            {archive.status === 'ready' ? <Badge tone={archive.enabled ? 'success' : 'neutral'}>{archive.enabled ? 'On' : 'Off'}</Badge> : null}
          </SettingRow>
          <SettingRow
            title="Telemetry"
            description="Your usage logs never leave your machine. The app sends only anonymous product-analytics events (which page is opened, exports, an anonymous install count) so the author can improve it — no tokens, file or project paths, session contents, or personal data. Opt out any time."
          >
            <Checkbox checked={view.telemetryOptOut} onCheckedChange={onTelemetryChange}>
              Disable anonymous analytics
            </Checkbox>
          </SettingRow>
          <SettingRow
            layout="stacked"
            title="Data folders"
            description="The folders the dashboard reads. Everything in them is read-only to the dashboard."
          >
            <div aria-busy={folders.status === 'loading'} className="flex min-w-0 flex-col gap-2">
              {folders.status === 'loading' ? <Skeleton className="h-4 w-72 max-w-full" /> : null}
              {folders.status === 'error' ? <p className="text-small text-fg-muted">Could not read the data folders. {RETRY_NOTE}</p> : null}
              {folders.status === 'ready' && folders.rows.length === 0 ? (
                <p className="text-small text-fg-muted">The server did not report its data folders.</p>
              ) : null}
              {folders.rows.map((folder) => (
                <KeyValueRow
                  key={folder.label}
                  label={folder.label}
                  value={
                    <span title={folder.path} className="block max-w-[min(32rem,60vw)] truncate">
                      {folder.path}
                    </span>
                  }
                />
              ))}
            </div>
          </SettingRow>
          <SettingRow
            layout="stacked"
            title="Version"
            description="The installed release and the newest one published. The check runs about every 30 minutes."
          >
            <div aria-busy={version.status === 'loading'} className="flex min-w-0 flex-col gap-2">
              {version.status === 'loading' ? <Skeleton className="h-4 w-48 max-w-full" /> : null}
              {version.status === 'error' ? <p className="text-small text-fg-muted">Could not check for updates. {RETRY_NOTE}</p> : null}
              {version.status === 'ready' ? (
                <>
                  <KeyValueRow label="Installed" value={version.current} />
                  <KeyValueRow
                    label="Latest"
                    value={version.latest}
                    tone={version.updateAvailable ? 'accent' : 'default'}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={version.updateAvailable ? 'accent' : 'neutral'}>
                      {version.updateAvailable ? 'Update available' : 'Up to date'}
                    </Badge>
                    {version.hint ? <p className="min-w-0 text-small text-fg-muted">{version.hint}</p> : null}
                    {version.changelogUrl ? (
                      <a href={version.changelogUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                        View changelog
                        <Icon name="externalLink" size={12} />
                      </a>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </SettingRow>
        </div>
      </Section>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        size="sm"
        title={FORGET_TITLE}
        description={FORGET_DESCRIPTION}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                forgetPending.current = true;
                onForget();
              }}
            >
              Forget history
            </Button>
          </>
        }
      />
    </div>
  );
}
