const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const status = (name) => ({ DEFAULT: token(name), soft: token(`${name}-soft`), fg: token(`${name}-fg`) });

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('bg'),
        surface: {
          DEFAULT: token('surface'),
          raised: token('surface-raised'),
          sunken: token('surface-sunken'),
          hover: token('surface-hover'),
        },
        line: {
          DEFAULT: token('border'),
          strong: token('border-strong'),
          control: token('border-control'),
        },
        focus: token('ring'),
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
          disabled: token('fg-disabled'),
          'on-accent': token('fg-on-accent'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          fg: token('accent-fg'),
        },
        success: status('success'),
        warning: status('warning'),
        danger: status('danger'),
        info: status('info'),
        platform: { claude: token('platform-claude'), codex: token('platform-codex') },
        heat: { 0: token('heat-0'), 1: token('heat-1'), 2: token('heat-2'), 3: token('heat-3'), 4: token('heat-4') },
        effort: {
          1: token('effort-1'),
          2: token('effort-2'),
          3: token('effort-3'),
          4: token('effort-4'),
          5: token('effort-5'),
          6: token('effort-6'),
          7: token('effort-7'),
          unknown: token('effort-unknown'),
        },
        chart: { grid: token('chart-grid'), axis: token('chart-axis'), cursor: token('chart-cursor') },
        overlay: 'var(--overlay)',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        caption: ['12px', { lineHeight: '16px' }],
        label: ['12px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '500' }],
        small: ['13px', { lineHeight: '18px' }],
        body: ['14px', { lineHeight: '20px' }],
        heading: ['14px', { lineHeight: '20px', fontWeight: '600' }],
        title: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        metric: ['20px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'metric-lg': ['32px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '600' }],
        mono: ['12px', { lineHeight: '16px' }],
        code: ['13px', { lineHeight: '20px' }],
      },
      borderRadius: {
        tag: '4px',
        control: '6px',
        card: '10px',
        dialog: '14px',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
      },
      spacing: {
        sidebar: '240px',
        rail: '56px',
        topbar: '52px',
        control: '32px',
        'control-sm': '28px',
      },
      maxWidth: {
        content: '1200px',
      },
      keyframes: {
        'live-ping': {
          '0%': { boxShadow: '0 0 0 0 color-mix(in srgb, currentColor 50%, transparent)' },
          '70%': { boxShadow: '0 0 0 8px transparent' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
      },
      animation: {
        'live-ping': 'live-ping 2s infinite',
      },
    },
  },
  plugins: [],
};
