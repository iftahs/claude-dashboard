import { useState } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { Dialog } from '@/components/design-system/molecules/Dialog/Dialog';
import { DropdownMenu } from '@/components/design-system/molecules/DropdownMenu/DropdownMenu';
import { FormField } from '@/components/design-system/molecules/FormField/FormField';
import { ThemeToggle } from '@/components/design-system/molecules/ThemeToggle/ThemeToggle';
import { Toast } from '@/components/design-system/molecules/Toast/Toast';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { useTheme } from '@/hooks/useTheme';
import { Specimen } from '../Specimen/Specimen';
import { CHART_TOOLTIP_ROWS, MENU_ACTIONS, ROW, TOASTS } from '../utils';

export function OverlayMolecules() {
  const { theme, toggleTheme } = useTheme();
  const [capsOpen, setCapsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dailyCap, setDailyCap] = useState('60.00');
  const [weeklyCap, setWeeklyCap] = useState('450.00');
  const [lastAction, setLastAction] = useState('');
  const [toastVisible, setToastVisible] = useState(true);

  return (
    <>
      <SplitLayout>
        <Specimen name="Dialog" note="A form and a confirmation. Escape or the overlay closes them.">
          <Button onClick={() => setCapsOpen(true)}>Edit spending caps</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Forget archive
          </Button>
          <Dialog
            open={capsOpen}
            onOpenChange={setCapsOpen}
            title="Spending caps"
            description="Caps are stored in this browser and compared with your estimated spend."
            footer={
              <>
                <Button variant="ghost" onClick={() => setCapsOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setCapsOpen(false)}>
                  Save caps
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <FormField label="Daily cap" htmlFor="ds-dialog-daily" helper="In US dollars. Leave empty for no cap.">
                <Input value={dailyCap} onChange={(event) => setDailyCap(event.target.value)} />
              </FormField>
              <FormField label="Weekly cap" htmlFor="ds-dialog-weekly" helper="You are at $412.80 this week.">
                <Input value={weeklyCap} onChange={(event) => setWeeklyCap(event.target.value)} />
              </FormField>
            </div>
          </Dialog>
          <Dialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            size="sm"
            title="Forget archived history"
            description="This removes usage from transcripts Claude Code has already deleted. It cannot be undone."
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Keep history
                </Button>
                <Button variant="danger" onClick={() => setConfirmOpen(false)}>
                  Forget archive
                </Button>
              </>
            }
          />
        </Specimen>
        <Specimen name="DropdownMenu" note={lastAction ? `Last picked: ${lastAction}` : 'Icons, a disabled item and a danger item'}>
          <DropdownMenu
            trigger={
              <Button>
                Session actions
                <Icon name="chevronDown" />
              </Button>
            }
            items={MENU_ACTIONS.map((action) => ({ ...action, onSelect: () => setLastAction(action.label) }))}
          />
          <DropdownMenu
            align="end"
            trigger={
              <Button variant="ghost" size="sm">
                Aligned to the end
                <Icon name="chevronDown" />
              </Button>
            }
            items={MENU_ACTIONS.slice(0, 3).map((action) => ({ ...action, onSelect: () => setLastAction(action.label) }))}
          />
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="Toast" note="One per tone. Danger is announced at once." layout="stack">
          {toastVisible ? (
            <Toast
              tone="warning"
              title="Weekly limit at 83%"
              description="Resets Monday 01:00. Workflow subagents are the largest share."
              onDismiss={() => setToastVisible(false)}
              action={<Button size="sm">Open live usage</Button>}
            />
          ) : (
            <div className={ROW}>
              <Button onClick={() => setToastVisible(true)}>Show the toast again</Button>
            </div>
          )}
          {TOASTS.map((toast) => (
            <Toast key={toast.tone} tone={toast.tone} title={toast.title} description={toast.description} />
          ))}
        </Specimen>
        <div className="flex min-w-0 flex-col gap-6">
          <Specimen name="ChartTooltip" note="Names every series, totals in the footer" layout="stack">
            <div className={ROW}>
              <ChartTooltip title="14:00 to 15:00" rows={CHART_TOOLTIP_ROWS} footer="1.3M tok effective, 9.8M tok with cache reads" />
              <ChartTooltip title="Thu, Sep 24" rows={[{ label: 'Est. cost', value: '~$71.60' }]} />
            </div>
          </Specimen>
          <Specimen name="ThemeToggle" note={`Showing the ${theme} theme`}>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <span className="text-small text-fg-muted">The same control sits in the topbar.</span>
          </Specimen>
        </div>
      </SplitLayout>
    </>
  );
}
