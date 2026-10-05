import { useState } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { Select } from '@/components/design-system/atoms/Select/Select';
import { CardHeader } from '@/components/design-system/molecules/CardHeader/CardHeader';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { FormField } from '@/components/design-system/molecules/FormField/FormField';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { LiveStatus } from '@/components/design-system/molecules/LiveStatus/LiveStatus';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { NavItem } from '@/components/design-system/molecules/NavItem/NavItem';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { StatTile } from '@/components/design-system/molecules/StatTile/StatTile';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { Specimen } from '../Specimen/Specimen';
import { DENSE_STATS, METERS, SKELETONS, STATS, WEEK_START_OPTIONS, WINDOW_FACTS } from '../utils';

export function DataMolecules() {
  const [cap, setCap] = useState('60.00');
  const [apiKey, setApiKey] = useState('sk-ant-0000');
  const [weekStart, setWeekStart] = useState('monday');
  const [retries, setRetries] = useState(0);

  return (
    <>
      <Specimen name="StatTile" note="Tones colour the value only. Dense tiles use the small size." layout="stack">
        <StatGridLayout columns={6}>
          {STATS.map((stat) => (
            <StatTile key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} tone={stat.tone} help={stat.help} />
          ))}
        </StatGridLayout>
        <StatGridLayout columns={4}>
          {DENSE_STATS.map((stat) => (
            <StatTile key={stat.label} size="sm" label={stat.label} value={stat.value} />
          ))}
        </StatGridLayout>
      </Specimen>
      <SplitLayout>
        <Specimen name="MeterRow" note="Accent below 70%, warning from 70%, danger from 90%" layout="stack">
          <Card as="div" className="flex flex-col gap-4">
            {METERS.map((meter) => (
              <MeterRow
                key={meter.label}
                label={meter.label}
                value={meter.value}
                percent={meter.percent}
                tone={meter.tone}
                note={meter.note}
              />
            ))}
            <MeterRow size="sm" label="Workflow subagents" value="38%" percent={38} />
            <MeterRow size="sm" label="Codex weekly limit" value="31%" percent={31} tone="codex" />
          </Card>
        </Specimen>
        <Specimen name="CardHeader" note="Title, description, help and an actions slot" layout="stack">
          <Card>
            <CardHeader
              title="5-hour window"
              description="Started 23:10, resets 04:10"
              help="Anthropic starts a window at a session's first message."
              actions={
                <Badge tone="success">
                  <Icon name="check" size={12} />
                  On track
                </Badge>
              }
            />
            <div className="flex flex-col gap-2">
              {WINDOW_FACTS.map((fact) => (
                <KeyValueRow key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          </Card>
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="FormField" note="A valid input, an invalid input and a select" layout="stack">
          <div className="flex flex-wrap items-start gap-5">
            <FormField label="Daily cap" htmlFor="ds-daily-cap" helper="In US dollars. Leave empty for no cap." className="w-56">
              <Input placeholder="60.00" value={cap} onChange={(event) => setCap(event.target.value)} />
            </FormField>
            <FormField label="API key" htmlFor="ds-api-key" error="This key is not valid." required className="w-56">
              <Input invalid placeholder="sk-ant-..." value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            </FormField>
            <FormField label="Week start" htmlFor="ds-week-start" helper="Weekly charts begin on this day." className="w-56">
              <Select
                ariaLabel="Week starts on"
                className="w-full"
                value={weekStart}
                onValueChange={setWeekStart}
                options={WEEK_START_OPTIONS}
              />
            </FormField>
          </div>
        </Specimen>
        <Specimen name="LiveStatus" note="Live, paused and offline">
          <LiveStatus state="live" />
          <LiveStatus state="paused" />
          <LiveStatus state="error" />
          <LiveStatus state="live" label="Live, updated 2s ago" />
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="EmptyState" note="What is missing and what makes it appear" layout="stack">
          <Card>
            <EmptyState
              icon="workflow"
              title="No workflows yet"
              description="Run one in Claude Code and it shows up here."
              action={<Button size="sm">Open the docs</Button>}
            />
          </Card>
        </Specimen>
        <Specimen name="ErrorState" note={retries > 0 ? `Retried ${retries} times` : 'What failed and what to do'} layout="stack">
          <Card>
            <ErrorState
              title="Could not load limit hits"
              description="The server did not answer. Showing nothing rather than stale data."
              onRetry={() => setRetries((count) => count + 1)}
            />
          </Card>
        </Specimen>
      </SplitLayout>
      <Specimen name="SkeletonPreset" note="Text, stat, chart, bars, gauge and table" layout="stack">
        <SplitLayout columns={3} gap="md" collapseBelow="md">
          {SKELETONS.slice(0, 3).map((skeleton) => (
            <Card key={skeleton.variant} as="div">
              <SkeletonPreset variant={skeleton.variant} rows={skeleton.rows} />
            </Card>
          ))}
        </SplitLayout>
        <SplitLayout gap="md" collapseBelow="md">
          {SKELETONS.slice(3).map((skeleton) => (
            <Card key={skeleton.variant} as="div">
              <SkeletonPreset variant={skeleton.variant} rows={skeleton.rows} />
            </Card>
          ))}
        </SplitLayout>
        <Card as="div" padding="none" className="overflow-hidden">
          <SkeletonPreset variant="table" rows={3} />
        </Card>
      </Specimen>
      <Specimen name="NavItem" note="Default, active with a badge, and collapsed for the rail" layout="stack">
        <div className="flex flex-wrap items-start gap-6">
          <Card as="div" padding="sm" className="flex w-sidebar max-w-full flex-col gap-0.5">
            <NavItem href="#molecules" label="Overview" icon="layout" />
            <NavItem href="#molecules" label="Live usage" icon="activity" active badge={<Badge tone="warning">83%</Badge>} />
            <NavItem href="#molecules" label="Agents" icon="bot" badge={<Badge>3</Badge>} />
            <NavItem href="#molecules" label="A page with a name too long for the sidebar" icon="folder" />
          </Card>
          <Card as="div" padding="sm" className="flex w-rail flex-col gap-0.5 px-[11px]">
            <NavItem href="#molecules" label="Overview" icon="layout" collapsed />
            <NavItem href="#molecules" label="Live usage" icon="activity" collapsed active badge={<Badge tone="warning">83%</Badge>} />
            <NavItem href="#molecules" label="Agents" icon="bot" collapsed badge={<Badge>3</Badge>} />
          </Card>
        </div>
      </Specimen>
    </>
  );
}
