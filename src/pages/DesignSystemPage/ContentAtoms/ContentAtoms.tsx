import { useState } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { modelColor } from '@/lib/palette';
import { Specimen } from '../Specimen/Specimen';
import type { RangeValue } from '../types';
import { MARKDOWN_SAMPLE, RANGE_OPTIONS, SESSIONS } from '../utils';

export function ContentAtoms() {
  const [range, setRange] = useState<RangeValue>('30d');
  const [selected, setSelected] = useState(SESSIONS[2].key);

  return (
    <>
      <SplitLayout>
        <Specimen name="Tooltip" note="Opens on hover and on focus">
          <Tooltip content="Cache reads are excluded from effective tokens. They do not count toward rate limits.">
            <Button>Effective tokens</Button>
          </Tooltip>
          <Tooltip content="Resets in 2h 14m, at 04:10" side="right" delay={0}>
            <Button variant="ghost">
              <Icon name="clock" />
              5-hour limit
            </Button>
          </Tooltip>
          <Tooltip content="Estimated equivalent API cost, not a bill." side="bottom">
            <Button variant="ghost">Est. cost</Button>
          </Tooltip>
        </Specimen>
        <Specimen name="InfoTip" note="Opens on click, closes on Escape">
          <span className="inline-flex items-center gap-1.5 text-body text-fg">
            Effective tokens
            <InfoTip
              label="About effective tokens"
              content="Input, output and cache writes. Cache reads do not count toward limits."
            />
          </span>
          <span className="inline-flex items-center gap-1.5 text-body text-fg">
            Est. cost
            <InfoTip label="About Est. cost" side="right" content="Estimated equivalent API cost, not a bill." />
          </span>
        </Specimen>
      </SplitLayout>
      <Specimen name="PageHeader" note="Description on the left, actions on the right" layout="stack">
        <PageHeader
          description="Your current window, plan limits and what is driving them."
          actions={
            <>
              <SegmentedControl ariaLabel="Range" size="sm" options={RANGE_OPTIONS} value={range} onChange={setRange} />
              <Button size="sm">
                <Icon name="download" />
                Export
              </Button>
            </>
          }
        />
      </Specimen>
      <SplitLayout>
        <div className="flex min-w-0 flex-col gap-6">
          <Specimen name="GroupLabel" note="Section heading with a quiet note" layout="stack">
            <GroupLabel as="span" note="Max 20x">
              Plan limits
            </GroupLabel>
            <GroupLabel as="span">Running now</GroupLabel>
          </Specimen>
          <Specimen name="Card" note="Padding none, sm and md" layout="stack">
            <Card as="div" padding="none">
              <p className="px-4 py-3 text-small text-fg-muted">No padding, for tables and split panels.</p>
            </Card>
            <Card as="div" padding="sm">
              <p className="text-small text-fg-muted">16px padding, for stat tiles and compact rows.</p>
            </Card>
            <Card as="div">
              <p className="text-small text-fg-muted">20px padding, the default for a card of content.</p>
            </Card>
          </Specimen>
        </div>
        <Specimen name="Markdown" note="A safe subset, rendered as elements" layout="stack">
          <Card as="div">
            <Markdown text={MARKDOWN_SAMPLE} />
          </Card>
        </Specimen>
      </SplitLayout>
      <Specimen name="Table, TableRow, TableCell" note="Rows: default with hover, held hover, selected. Click a row to select it." layout="stack">
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table caption="Recent sessions">
              <thead>
                <TableRow>
                  <TableCell header>Session</TableCell>
                  <TableCell header>Model</TableCell>
                  <TableCell header numeric>
                    Tokens
                  </TableCell>
                  <TableCell header numeric>
                    Est. cost
                  </TableCell>
                  <TableCell header numeric>
                    When
                  </TableCell>
                </TableRow>
              </thead>
              <tbody>
                {SESSIONS.map((session, index) => (
                  <TableRow
                    key={session.key}
                    interactive
                    state={session.key === selected ? 'selected' : 'default'}
                    className={index === 1 && session.key !== selected ? 'bg-surface-hover' : undefined}
                    tabIndex={0}
                    aria-current={session.key === selected ? 'true' : undefined}
                    onClick={() => setSelected(session.key)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setSelected(session.key);
                    }}
                  >
                    <TableCell truncate title={session.title} className="min-w-48">
                      {session.title}
                    </TableCell>
                    <TableCell>
                      <Chip color={modelColor(session.model.id)}>{session.model.label}</Chip>
                    </TableCell>
                    <TableCell numeric>{session.tokens}</TableCell>
                    <TableCell numeric>{session.cost}</TableCell>
                    <TableCell numeric>{session.when}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </Specimen>
    </>
  );
}
