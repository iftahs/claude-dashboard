import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { NotificationProvider } from './hooks/useNotifications';
import { NotificationHost } from './components/design-system/organisms/NotificationHost/NotificationHost';
import './index.css';

initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter>
        <NotificationProvider>
          <App />
          <NotificationHost />
        </NotificationProvider>
      </BrowserRouter>
    </PostHogProvider>
  </StrictMode>
);
