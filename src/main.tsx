import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { NotificationProvider } from './hooks/useNotifications';
import { SourceProvider } from './hooks/useSource';
import { ConfigModeProvider } from './hooks/useConfigMode';
import { LiveDataProvider } from './hooks/useLiveData';
import { AiInsightProvider } from './hooks/useAiInsightContext';
import { PageActionsProvider } from './hooks/usePageActions';
import { ThemeProvider } from './hooks/useTheme';
import { NotificationHost } from './components/common/NotificationHost/NotificationHost';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './index.css';

initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ThemeProvider>
        <BrowserRouter>
          <NotificationProvider>
            <SourceProvider>
              <ConfigModeProvider>
                <LiveDataProvider>
                  <AiInsightProvider>
                    <PageActionsProvider>
                      <App />
                      <NotificationHost />
                    </PageActionsProvider>
                  </AiInsightProvider>
                </LiveDataProvider>
              </ConfigModeProvider>
            </SourceProvider>
          </NotificationProvider>
        </BrowserRouter>
      </ThemeProvider>
    </PostHogProvider>
  </StrictMode>
);
