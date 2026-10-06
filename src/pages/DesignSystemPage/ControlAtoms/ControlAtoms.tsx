import { useState } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Checkbox } from '@/components/design-system/atoms/Checkbox/Checkbox';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { Kbd } from '@/components/design-system/atoms/Kbd/Kbd';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Select } from '@/components/design-system/atoms/Select/Select';
import { SettingRow } from '@/components/design-system/atoms/SettingRow/SettingRow';
import { Tabs } from '@/components/design-system/atoms/Tabs/Tabs';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { Specimen } from '../Specimen/Specimen';
import type { AgentFilter, InsightView, PlatformValue, RangeValue } from '../types';
import {
  AGENT_TABS,
  INSIGHT_PANELS,
  INSIGHT_TABS,
  MODEL_OPTIONS,
  PLATFORM_OPTIONS,
  RANGE_OPTIONS,
  ROW,
  WEEK_START_OPTIONS,
} from '../utils';

export function ControlAtoms() {
  const [platform, setPlatform] = useState<PlatformValue>('claude');
  const [range, setRange] = useState<RangeValue>('30d');
  const [view, setView] = useState<InsightView>('reliability');
  const [agents, setAgents] = useState<AgentFilter>('running');
  const [weekStart, setWeekStart] = useState('monday');
  const [model, setModel] = useState<string | undefined>(undefined);
  const [cap, setCap] = useState('60.00');
  const [optOut, setOptOut] = useState(false);
  const [alertAt, setAlertAt] = useState(true);

  return (
    <>
      <SplitLayout>
        <Specimen name="Button" note="Four variants and disabled, at 32px and 28px" layout="stack">
          <div className={ROW}>
            <Button variant="primary">Start export</Button>
            <Button>
              <Icon name="download" />
              Export
            </Button>
            <Button variant="ghost">
              <Icon name="chevronRight" />
              Details
            </Button>
            <Button variant="danger">Forget archive</Button>
            <Button disabled>Unavailable</Button>
          </div>
          <div className={ROW}>
            <Button variant="primary" size="sm">
              Primary
            </Button>
            <Button size="sm">
              <Icon name="download" />
              Secondary
            </Button>
            <Button variant="ghost" size="sm">
              Ghost
            </Button>
            <Button variant="danger" size="sm">
              Danger
            </Button>
            <Button size="sm" disabled>
              Unavailable
            </Button>
          </div>
        </Specimen>
        <Specimen name="IconButton" note="Ghost and secondary, both sizes, disabled">
          <Tooltip content="Refresh">
            <IconButton label="Refresh">
              <Icon name="refresh" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Filter sessions">
            <IconButton label="Filter sessions" variant="secondary">
              <Icon name="filter" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Copy session ID">
            <IconButton label="Copy session ID" size="sm">
              <Icon name="copy" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Export">
            <IconButton label="Export" variant="secondary" size="sm">
              <Icon name="download" />
            </IconButton>
          </Tooltip>
          <IconButton label="Refresh is unavailable" disabled>
            <Icon name="refresh" />
          </IconButton>
          <IconButton label="Filter is unavailable" variant="secondary" disabled>
            <Icon name="filter" />
          </IconButton>
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="SegmentedControl" note="Neutral track, selected segment on surface-raised">
          <SegmentedControl ariaLabel="Platform" options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} />
          <SegmentedControl ariaLabel="Range" size="sm" options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </Specimen>
        <Specimen name="Kbd" note="Shortcut hints">
          <Kbd>Ctrl K</Kbd>
          <Kbd>Esc</Kbd>
          <Kbd>Enter</Kbd>
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-small text-fg-subtle">
            Jump to
            <Kbd>Ctrl K</Kbd>
          </span>
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="Tabs" note="Arrow keys move between tabs" layout="stack">
          <Tabs id="ds-insights" ariaLabel="Insights views" items={INSIGHT_TABS} value={view} onChange={setView} />
          <div
            role="tabpanel"
            id={`ds-insights-panel-${view}`}
            aria-labelledby={`ds-insights-tab-${view}`}
            tabIndex={0}
            className="rounded-control text-small text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {INSIGHT_PANELS[view]}
          </div>
        </Specimen>
        <Specimen name="Tabs with counts" note="A count after the label" layout="stack">
          <Tabs ariaLabel="Agents" items={AGENT_TABS} value={agents} onChange={setAgents} />
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="Input" note="Default, small, invalid and disabled">
          <Input
            aria-label="Daily cap"
            className="w-56"
            placeholder="60.00"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
          />
          <Input aria-label="Search sessions" className="w-56" size="sm" placeholder="Search sessions" />
          <Input aria-label="API key" className="w-56" invalid defaultValue="sk-ant-..." />
          <Input aria-label="Weekly cap" className="w-56" disabled placeholder="Set a daily cap first" />
        </Specimen>
        <Specimen name="Select" note="With a value, small with a placeholder, disabled">
          <Select
            ariaLabel="Week starts on"
            className="w-56"
            value={weekStart}
            onValueChange={setWeekStart}
            options={WEEK_START_OPTIONS}
          />
          <Select
            ariaLabel="Model"
            size="sm"
            className="w-40"
            placeholder="Any model"
            value={model}
            onValueChange={setModel}
            options={MODEL_OPTIONS}
          />
          <Select
            ariaLabel="Week starts on, unavailable"
            className="w-56"
            disabled
            value="monday"
            onValueChange={setWeekStart}
            options={WEEK_START_OPTIONS}
          />
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="Checkbox" note="Unchecked, checked and both disabled states. The label is part of the click target.">
          <Checkbox checked={optOut} onCheckedChange={setOptOut}>
            Disable anonymous analytics
          </Checkbox>
          <Checkbox checked={alertAt} onCheckedChange={setAlertAt}>
            70%
          </Checkbox>
          <Checkbox checked={false} disabled onCheckedChange={() => undefined}>
            Unavailable
          </Checkbox>
          <Checkbox checked disabled onCheckedChange={() => undefined}>
            Locked on
          </Checkbox>
        </Specimen>
        <Specimen name="SettingRow" note="Inline with its control, with content underneath, and stacked" layout="stack">
          <div className="flex flex-col divide-y divide-line">
            <SettingRow title="Range" description="The window the charts on this page cover.">
              <SegmentedControl ariaLabel="Range" size="sm" options={RANGE_OPTIONS} value={range} onChange={setRange} />
            </SettingRow>
            <SettingRow
              title="Telemetry"
              description="Anonymous product analytics. No paths, tokens or session contents."
              below={<p className="text-caption text-fg-subtle">Content under the row takes the full width.</p>}
            >
              <Checkbox checked={optOut} onCheckedChange={setOptOut}>
                Disable anonymous analytics
              </Checkbox>
            </SettingRow>
            <SettingRow layout="stacked" title="Daily cap" description="Stacked: the control sits under the text at full width.">
              <Input aria-label="Daily cap, stacked" placeholder="60.00" value={cap} onChange={(event) => setCap(event.target.value)} />
            </SettingRow>
          </div>
        </Specimen>
      </SplitLayout>
    </>
  );
}
