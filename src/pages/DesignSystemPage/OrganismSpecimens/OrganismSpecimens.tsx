import { useEffect, useState } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Kbd } from '@/components/design-system/atoms/Kbd/Kbd';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { CommandPalette } from '@/components/design-system/organisms/CommandPalette/CommandPalette';
import { ExportMenu } from '@/components/design-system/organisms/ExportMenu/ExportMenu';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { PALETTE_SHORTCUT, useCommandPalette } from '@/hooks/useCommandPalette';
import { useExport } from '@/hooks/useExport';
import { useRegisterPageExport } from '@/hooks/usePageActions';
import type { ExportFormat } from '@/lib/export';
import type { SectionAi } from '@/lib/section';
import { Specimen } from '../Specimen/Specimen';
import type { AskState } from '../types';
import { AI_ANSWER_DELAY_MS, AI_ERROR_SAMPLE, AI_INSIGHT_SAMPLE, GALLERY_EXPORT, METERS, ROW, SESSIONS, WINDOW_FACTS } from '../utils';
import { AgentWorkflowSpecimens } from './AgentWorkflowSpecimens/AgentWorkflowSpecimens';
import { LiveSpecimens } from './LiveSpecimens/LiveSpecimens';
import { SessionsSpecimens } from './SessionsSpecimens/SessionsSpecimens';
import { WorkspaceAiSettingsSpecimens } from './WorkspaceAiSettingsSpecimens/WorkspaceAiSettingsSpecimens';

export function OrganismSpecimens() {
  const [ask, setAsk] = useState<AskState>('idle');
  const [failedAsk, setFailedAsk] = useState(true);
  const [retries, setRetries] = useState(0);
  const [exportRegistered, setExportRegistered] = useState(true);
  const [lastExport, setLastExport] = useState('');
  const exportData = useExport();
  const palette = useCommandPalette();

  useRegisterPageExport(exportRegistered ? GALLERY_EXPORT : null);

  useEffect(() => {
    if (ask !== 'loading') return undefined;
    const id = setTimeout(() => setAsk('done'), AI_ANSWER_DELAY_MS);
    return () => clearTimeout(id);
  }, [ask]);

  const onExport = (format: ExportFormat) => {
    exportData(GALLERY_EXPORT, format);
    setLastExport(format.toUpperCase());
  };

  const liveAi: SectionAi = {
    onAsk: () => setAsk('loading'),
    loading: ask === 'loading',
    result:
      ask === 'idle'
        ? null
        : { loading: ask === 'loading', text: AI_INSIGHT_SAMPLE, backendLabel: 'via claude -p', onDismiss: () => setAsk('idle') },
  };
  const failedAi: SectionAi = {
    onAsk: () => setFailedAsk(true),
    result: failedAsk ? { loading: false, error: AI_ERROR_SAMPLE, onDismiss: () => setFailedAsk(false) } : null,
  };
  const idleAi: SectionAi = { onAsk: () => undefined };

  return (
    <>
      <Specimen
        name="Section"
        note="Ready with a live AI button, loading, failed and empty. The grow cards end at the same height."
        layout="stack"
      >
        <SplitLayout>
          <Section
            title="5-hour window"
            description="Started 23:10, resets 04:10"
            help="Anthropic starts a window at a session's first message."
            actions={<Badge tone="success">On track</Badge>}
            ai={liveAi}
            grow
          >
            <div className="flex flex-col gap-2">
              {WINDOW_FACTS.map((fact) => (
                <KeyValueRow key={fact.label} label={fact.label} value={fact.value} help={fact.help} tone={fact.tone} />
              ))}
            </div>
          </Section>
          <Section
            title="What is contributing to your limits"
            description="Share of this week, weighted by cost"
            ai={idleAi}
            state={{ kind: 'loading', skeleton: 'bars', rows: 3 }}
            grow
          />
        </SplitLayout>
        <SplitLayout>
          <Section
            title="Limit hits"
            description={retries > 0 ? `Retried ${retries} times` : 'Last 30 days'}
            ai={idleAi}
            state={{
              kind: 'error',
              title: 'Could not load limit hits',
              description: 'The server did not answer. Showing nothing rather than stale data.',
              onRetry: () => setRetries((count) => count + 1),
            }}
            grow
          />
          <Section
            title="Workflow runs"
            description="Last 30 days"
            ai={idleAi}
            state={{
              kind: 'empty',
              icon: 'workflow',
              title: 'No workflows yet',
              description: 'Run one in Claude Code and it shows up here.',
              action: <Button size="sm">Open the docs</Button>,
            }}
            grow
          />
        </SplitLayout>
      </Specimen>
      <Specimen name="Section with an AI result" note="The result opens under the content. A failed answer says why." layout="stack">
        <SplitLayout>
          <Section
            title="Spend against your caps"
            description="This week, estimated"
            as="h3"
            ai={{
              onAsk: () => undefined,
              result: { loading: false, text: AI_INSIGHT_SAMPLE, backendLabel: 'via Claude.ai', onDismiss: () => undefined },
            }}
          >
            <div className="flex flex-col gap-4">
              {METERS.slice(1).map((meter) => (
                <MeterRow key={meter.label} label={meter.label} value={meter.value} percent={meter.percent} tone={meter.tone} />
              ))}
            </div>
          </Section>
          <Section title="Model mix" description="Share of effective tokens" as="h3" padding="sm" ai={failedAi}>
            <div className="flex flex-col gap-2">
              <KeyValueRow label="opus 5.5" value="61%" />
              <KeyValueRow label="sonnet 5.5" value="32%" />
              <KeyValueRow label="haiku 4.5" value="7%" />
            </div>
          </Section>
        </SplitLayout>
      </Specimen>
      <Specimen name="Section, edge to edge" note="Padding none: the header keeps its padding, the body runs to the card's edges" layout="stack">
        <SplitLayout>
          <Section title="Recent sessions" description="Newest first" as="h3" padding="none" actions={<ExportMenu onExport={onExport} />}>
            <div className="overflow-x-auto">
              <Table caption="Recent sessions">
                <thead>
                  <TableRow>
                    <TableCell header>Session</TableCell>
                    <TableCell header>Model</TableCell>
                    <TableCell header numeric>
                      Est. cost
                    </TableCell>
                  </TableRow>
                </thead>
                <tbody>
                  {SESSIONS.map((session) => (
                    <TableRow key={session.key}>
                      <TableCell>
                        <span title={session.title} className="block max-w-[260px] truncate">
                          {session.title}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ModelChip model={session.model.id} />
                      </TableCell>
                      <TableCell numeric>{session.cost}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Section>
          <Section
            title="Recent sessions"
            description="Newest first"
            as="h3"
            padding="none"
            state={{ kind: 'loading', skeleton: 'table', rows: 3 }}
          />
        </SplitLayout>
      </Specimen>
      <SplitLayout>
        <Specimen name="ExportMenu" note={lastExport ? `Last export: ${lastExport}` : 'CSV or JSON. Disabled while there is nothing to export.'}>
          <ExportMenu onExport={onExport} align="start" />
          <ExportMenu label="Export sessions" onExport={onExport} align="start" />
          <ExportMenu onExport={onExport} disabled />
        </Specimen>
        <Specimen
          name="CommandPalette"
          note={exportRegistered ? 'This page registered an export, so the palette offers it' : 'No export registered: the palette has no export actions'}
        >
          <Button onClick={() => palette.setOpen(true)}>
            <Icon name="command" />
            Open the command palette
            <Kbd>{PALETTE_SHORTCUT}</Kbd>
          </Button>
          <Button variant="ghost" onClick={() => setExportRegistered((registered) => !registered)}>
            {exportRegistered ? 'Unregister the page export' : 'Register the page export'}
          </Button>
          <span className={ROW}>
            <Badge tone={exportRegistered ? 'success' : 'neutral'}>{palette.exportCommands.length} export actions</Badge>
          </span>
        </Specimen>
      </SplitLayout>
      <LiveSpecimens />
      <AgentWorkflowSpecimens />
      <WorkspaceAiSettingsSpecimens />
      <SessionsSpecimens />
      <CommandPalette
        open={palette.open}
        onOpenChange={palette.setOpen}
        groups={palette.exportCommands.length > 0 ? [{ id: 'actions', heading: 'Actions', items: palette.exportCommands }] : []}
      />
    </>
  );
}
