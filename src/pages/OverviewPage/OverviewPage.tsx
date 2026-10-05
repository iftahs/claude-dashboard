import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { LimitGlance } from '@/components/design-system/organisms/LimitGlance/LimitGlance';
import { RunningNow } from '@/components/design-system/organisms/RunningNow/RunningNow';
import { SpendToday } from '@/components/design-system/organisms/SpendToday/SpendToday';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { useOverviewPage } from '@/hooks/useOverviewPage';

const LIVE_HREF = '/live';
const AGENTS_HREF = '/agents';

export function OverviewPage() {
  const { limits, limitsNote, running, today, onNavigate } = useOverviewPage();
  const limitCards = limits.map((card) => <LimitGlance key={card.platform} view={card} href={LIVE_HREF} onNavigate={onNavigate} />);

  return (
    <PageLayout>
      <SectionStackLayout title={<GroupLabel note={limitsNote}>Limits</GroupLabel>}>
        {limitCards.length > 1 ? <SplitLayout>{limitCards}</SplitLayout> : limitCards}
      </SectionStackLayout>
      <SectionStackLayout title={<GroupLabel>Running now</GroupLabel>}>
        <RunningNow view={running} href={AGENTS_HREF} onNavigate={onNavigate} />
      </SectionStackLayout>
      <SectionStackLayout title={<GroupLabel>Today</GroupLabel>}>
        <SplitLayout>
          {today.map((card) => (
            <SpendToday key={card.key} view={card} />
          ))}
        </SplitLayout>
      </SectionStackLayout>
    </PageLayout>
  );
}
