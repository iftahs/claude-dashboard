import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Select } from '@/components/design-system/atoms/Select/Select';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { AiChat } from '@/components/design-system/organisms/AiChat/AiChat';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { useAiPage } from '@/hooks/useAiPage';

export function AiPage() {
  const { description, header, chat, onDaysChange, onModelChange, onReset, onAsk, onNavigate } = useAiPage();

  const actions = header ? (
    <>
      {header.backend ? <Badge title={header.backend.title}>{header.backend.label}</Badge> : null}
      {header.picker ? (
        <Select
          ariaLabel="Model"
          size="sm"
          className="w-56"
          value={header.picker.value}
          onValueChange={onModelChange}
          options={header.picker.options}
        />
      ) : null}
      {header.serverModel ? <ModelChip model={header.serverModel} /> : null}
      <SegmentedControl ariaLabel="Range" size="sm" options={header.dayOptions} value={header.days} onChange={onDaysChange} />
      {header.canReset ? (
        <Button size="sm" variant="ghost" title="Start a new conversation" onClick={onReset}>
          <Icon name="plus" size={14} />
          New chat
        </Button>
      ) : null}
    </>
  ) : undefined;

  return (
    <PageLayout width="full" header={<PageHeader description={description} actions={actions} />}>
      <AiChat view={chat} onAsk={onAsk} onNavigate={onNavigate} />
    </PageLayout>
  );
}
