import { Button } from '@/components/design-system/atoms/Button/Button';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Kbd } from '@/components/design-system/atoms/Kbd/Kbd';
import { CardHeader } from '@/components/design-system/molecules/CardHeader/CardHeader';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { Specimen } from '../Specimen/Specimen';
import { ROW } from '../utils';
import { LayoutBlock } from './LayoutBlock/LayoutBlock';
import type { TemplateSpecimensProps } from './types';

export function TemplateSpecimens({ sidebarCollapsed, drawerOpen, onToggleSidebar, onOpenDrawer }: TemplateSpecimensProps) {
  return (
    <>
      <SplitLayout>
        <Specimen name="AppShellLayout" note="The frame of this page" layout="stack">
          <Card>
            <CardHeader
              title="Sidebar, sticky topbar and scrolling main"
              description="From 1024px the sidebar is a 240px column or a 56px rail. Below that it is a drawer over a scrim."
            />
            <div className={ROW}>
              <Button className="hidden lg:inline-flex" aria-pressed={sidebarCollapsed} onClick={onToggleSidebar}>
                <Icon name="panel" />
                {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </Button>
              <Button className="lg:hidden" aria-expanded={drawerOpen} onClick={onOpenDrawer}>
                <Icon name="menu" />
                Open navigation
              </Button>
              <span className="inline-flex items-center gap-2 text-small text-fg-muted lg:hidden">
                <Kbd>Esc</Kbd>
                closes the drawer
              </span>
            </div>
          </Card>
        </Specimen>
        <Specimen name="PageLayout" note="The column this page sits in" layout="stack">
          <Card>
            <CardHeader
              title="Content column"
              description="At most 1200px wide and centred, with 32px gutters from 1024px and 16px below. Rows sit 24px apart."
              className="mb-0"
            />
          </Card>
        </Specimen>
      </SplitLayout>
      <Specimen name="SplitLayout" note="Equal, 1:2, 2:1 and three columns. One column on narrow screens." layout="stack">
        <SplitLayout gap="md">
          <LayoutBlock>1fr</LayoutBlock>
          <LayoutBlock>1fr</LayoutBlock>
        </SplitLayout>
        <SplitLayout ratio="1:2" gap="md">
          <LayoutBlock>1fr</LayoutBlock>
          <LayoutBlock>2fr</LayoutBlock>
        </SplitLayout>
        <SplitLayout ratio="2:1" gap="md">
          <LayoutBlock>2fr</LayoutBlock>
          <LayoutBlock>1fr</LayoutBlock>
        </SplitLayout>
        <SplitLayout columns={3} gap="md" collapseBelow="md">
          <LayoutBlock>1fr, collapses below 768px</LayoutBlock>
          <LayoutBlock>1fr</LayoutBlock>
          <LayoutBlock>1fr</LayoutBlock>
        </SplitLayout>
      </Specimen>
      <SplitLayout>
        <Specimen name="StatGridLayout" note="Two to six columns, 16px apart" layout="stack">
          <StatGridLayout columns={2}>
            <LayoutBlock>2 columns</LayoutBlock>
            <LayoutBlock>2 columns</LayoutBlock>
          </StatGridLayout>
          <StatGridLayout columns={4}>
            <LayoutBlock>4 columns</LayoutBlock>
            <LayoutBlock>4 columns</LayoutBlock>
            <LayoutBlock>4 columns</LayoutBlock>
            <LayoutBlock>4 columns</LayoutBlock>
          </StatGridLayout>
        </Specimen>
        <Specimen name="SectionStackLayout" note="24px between cards, or 12px for a tight list" layout="stack">
          <SectionStackLayout title={<GroupLabel as="span">Plan limits</GroupLabel>}>
            <LayoutBlock>Card</LayoutBlock>
            <LayoutBlock>Card, 24px below</LayoutBlock>
          </SectionStackLayout>
          <SectionStackLayout spacing="sm" title={<GroupLabel as="span" note="Tight">Earlier this week</GroupLabel>}>
            <LayoutBlock>Run</LayoutBlock>
            <LayoutBlock>Run, 12px below</LayoutBlock>
          </SectionStackLayout>
        </Specimen>
      </SplitLayout>
    </>
  );
}
