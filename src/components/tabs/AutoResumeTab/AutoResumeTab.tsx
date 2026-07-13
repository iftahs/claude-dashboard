import { AutoResumeView } from '@/components/design-system/organisms/AutoResumeView/AutoResumeView';
import { useAutoResume } from '@/hooks/useAutoResume';
import { useConfigMode } from '@/hooks/useConfigMode';

export function AutoResumeTab() {
  const autoResume = useAutoResume();
  const { configData } = useConfigMode();
  return <AutoResumeView autoResume={autoResume} allowRules={configData?.permissions?.allow ?? []} />;
}
