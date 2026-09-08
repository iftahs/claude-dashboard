import { useEffect, useMemo, useState } from 'react';
import { usd, compact } from '@/lib/format';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import type { CostCalculationProps, ModelPrice, PriceGroup, PricePlatform } from './types';
import { billingBlurb, calcCost, priceGroups } from './utils';

/** "$3.00", or "—" for the cache-write column of a vendor that has no such charge. */
function rate(model: ModelPrice, field: 'input' | 'output' | 'cacheWrite' | 'cacheRead') {
  if (field === 'cacheWrite' && model.platform === 'openai') return '—';
  return `$${model[field].toFixed(2)}`;
}

function PriceRow({
  model,
  selected,
  onSelect,
}: {
  model: ModelPrice;
  selected: boolean;
  onSelect: (m: ModelPrice) => void;
}) {
  return (
    <tr
      className={`hover:bg-white/10 transition-colors cursor-pointer ${
        selected ? 'bg-clay-500/10 text-clay-400 font-medium' : ''
      }`}
      onClick={() => onSelect(model)}
    >
      <td className="py-3 pr-2">
        {model.name}
        {model.note && <span className="ml-1.5 text-[10px] text-zinc-500">{model.note}</span>}
      </td>
      <td className="py-3 pl-3 text-right tabular-nums">{rate(model, 'input')}</td>
      <td className="py-3 pl-3 text-right tabular-nums">{rate(model, 'output')}</td>
      <td className="py-3 pl-3 text-right tabular-nums">{rate(model, 'cacheWrite')}</td>
      <td className="py-3 pl-3 text-right tabular-nums">{rate(model, 'cacheRead')}</td>
    </tr>
  );
}

/**
 * Reference rate cards + a sandbox calculator. The rows shown follow the header
 * platform switcher: Claude's card alone, OpenAI's (Codex) card alone, or both —
 * Claude first, except under Codex where the GPT rows lead because they are the
 * only ones that describe what the user is looking at.
 */
export function CostCalculation({ platform }: CostCalculationProps) {
  const groups = useMemo(() => priceGroups(platform), [platform]);
  const showGroupLabels = groups.length > 1;

  const [selectedModel, setSelectedModel] = useState<ModelPrice>(() => groups[0].current[0]);
  const [expanded, setExpanded] = useState<Partial<Record<PricePlatform, boolean>>>({});
  const [inputTokens, setInputTokens] = useState(100_000);
  const [outputTokens, setOutputTokens] = useState(20_000);
  const [cacheWriteTokens, setCacheWriteTokens] = useState(50_000);
  const [cacheReadTokens, setCacheReadTokens] = useState(200_000);

  // Switching platform can hide the selected row; fall back to the first row of
  // the leading group so the calculator never prices an invisible model.
  useEffect(() => {
    if (!groups.some((g) => g.platform === selectedModel.platform)) {
      setSelectedModel(groups[0].current[0]);
    }
  }, [groups, selectedModel.platform]);

  const calculateCost = () =>
    calcCost(selectedModel, {
      input: inputTokens,
      output: outputTokens,
      cacheWrite: cacheWriteTokens,
      cacheRead: cacheReadTokens,
    });

  const noCacheWrite = selectedModel.platform === 'openai';

  const renderGroup = (g: PriceGroup) => (
    <div key={g.platform} className={showGroupLabels ? 'mt-5 first:mt-0' : ''}>
      {showGroupLabels && (
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {g.label}
        </div>
      )}
      {/* `whitespace-nowrap` on the rate headers: a row's note ("internal review
          model — not billed") widens the Model column enough to wrap them otherwise. */}
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500 font-semibold uppercase tracking-wider">
            <th className="py-2.5">Model</th>
            <th className="py-2.5 pl-3 text-right whitespace-nowrap">Input / 1M</th>
            <th className="py-2.5 pl-3 text-right whitespace-nowrap">Output / 1M</th>
            <th className="py-2.5 pl-3 text-right whitespace-nowrap">Cache Write / 1M</th>
            <th className="py-2.5 pl-3 text-right whitespace-nowrap">Cache Read / 1M</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-zinc-300">
          {g.current.map((model) => (
            <PriceRow
              key={model.name}
              model={model}
              selected={selectedModel.name === model.name}
              onSelect={setSelectedModel}
            />
          ))}
          {expanded[g.platform] &&
            g.legacy.map((model) => (
              <PriceRow
                key={model.name}
                model={model}
                selected={selectedModel.name === model.name}
                onSelect={setSelectedModel}
              />
            ))}
        </tbody>
      </table>

      {g.legacy.length > 0 && (
        <div className="mt-4 flex justify-start">
          <button
            onClick={() => setExpanded((e) => ({ ...e, [g.platform]: !e[g.platform] }))}
            className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {expanded[g.platform] ? 'Hide other models' : `Show other models (${g.legacy.length})`}
            <span>{expanded[g.platform] ? '▲' : '▼'}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="card p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
            Cost Calculation Explained
            <InfoTip text="Reference pay-as-you-go API prices (per 1M tokens, by model). Your subscription has no per-token bill — these power the 'estimated equivalent cost' figures. Use the calculator to price a hypothetical request; cache reads are billed at ~10% of input." />
          </h2>
          <p className="text-xs text-zinc-500">{billingBlurb(platform)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Pricing Table(s) — one rate card per vendor in scope */}
        <div className="lg:col-span-7 overflow-x-auto">
          {groups.map(renderGroup)}

          <div className="mt-4 rounded-xl bg-ink-700/30 p-3 text-xs text-zinc-400 leading-relaxed border border-white/10">
            <span className="font-semibold text-zinc-300">💡 Prompt Caching Benefit:</span> Cache reads cost only <strong>10%</strong> of standard input price. Designing your prompts to reuse systemic instructions, codebase maps, or tool schemas leverages this pricing to achieve massive savings.
            {platform !== 'claude' && (
              <> OpenAI applies the same discount to cached input but charges nothing to write the cache, so its Cache Write column reads “—”.</>
            )}
          </div>
        </div>

        {/* Right: Interactive Sandbox Calculator */}
        <div className="lg:col-span-5 flex flex-col rounded-xl bg-ink-700/50 p-5 border border-white/10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Interactive Cost Calculator</span>
              <div className="mt-1 text-xs text-zinc-500 font-sans">
                Adjust the tokens below for <span className="text-clay-400 font-semibold">{selectedModel.name}</span>
                <span className="block text-[10px] text-zinc-500/80 mt-0.5">💡 Double-click any slider to reset to initial value</span>
              </div>
            </div>
            <button
              onClick={() => {
                setInputTokens(100_000);
                setOutputTokens(20_000);
                setCacheWriteTokens(50_000);
                setCacheReadTokens(200_000);
              }}
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-clay-400 hover:text-clay-300 hover:bg-clay-500/10 ring-1 ring-clay-500/30 px-2.5 py-1 rounded transition-colors"
              title="Reset all inputs to defaults"
            >
              Reset
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {/* Input Tokens */}
            <div
              className="group cursor-pointer select-none"
              onDoubleClick={() => setInputTokens(100_000)}
              title="Double-click to reset to initial value"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">Input Tokens</span>
                <span className="text-zinc-500 font-mono">{inputTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1000000"
                step="5000"
                value={inputTokens}
                onChange={(e) => setInputTokens(Number(e.target.value))}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setInputTokens(100_000);
                }}
                className="w-full h-1.5 bg-ink-600 rounded-lg appearance-none cursor-pointer accent-clay-500"
              />
            </div>

            {/* Output Tokens */}
            <div
              className="group cursor-pointer select-none"
              onDoubleClick={() => setOutputTokens(20_000)}
              title="Double-click to reset to initial value"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">Output Tokens</span>
                <span className="text-zinc-500 font-mono">{outputTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="200000"
                step="1000"
                value={outputTokens}
                onChange={(e) => setOutputTokens(Number(e.target.value))}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setOutputTokens(20_000);
                }}
                className="w-full h-1.5 bg-ink-600 rounded-lg appearance-none cursor-pointer accent-clay-500"
              />
            </div>

            {/* Cache Write Tokens — free on OpenAI, so the row says so rather than
                implying the slider moves the total. */}
            <div
              className="group cursor-pointer select-none"
              onDoubleClick={() => setCacheWriteTokens(50_000)}
              title="Double-click to reset to initial value"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  Cache Write Tokens
                  {noCacheWrite && <span className="ml-1.5 text-[10px] text-zinc-600">not charged</span>}
                </span>
                <span className="text-zinc-500 font-mono">{cacheWriteTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="500000"
                step="5000"
                value={cacheWriteTokens}
                onChange={(e) => setCacheWriteTokens(Number(e.target.value))}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setCacheWriteTokens(50_000);
                }}
                className={`w-full h-1.5 bg-ink-600 rounded-lg appearance-none cursor-pointer accent-clay-500 ${
                  noCacheWrite ? 'opacity-50' : ''
                }`}
              />
            </div>

            {/* Cache Read Tokens */}
            <div
              className="group cursor-pointer select-none"
              onDoubleClick={() => setCacheReadTokens(200_000)}
              title="Double-click to reset to initial value"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">Cache Read Tokens</span>
                <span className="text-zinc-500 font-mono">{cacheReadTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000000"
                step="10000"
                value={cacheReadTokens}
                onChange={(e) => setCacheReadTokens(Number(e.target.value))}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setCacheReadTokens(200_000);
                }}
                className="w-full h-1.5 bg-ink-600 rounded-lg appearance-none cursor-pointer accent-clay-500"
              />
            </div>
          </div>

          {/* Formula & Total */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Calculated Cost</span>
              <span className="text-xl font-bold text-clay-400 tabular-nums">{usd(calculateCost())}</span>
            </div>

            {/* Visual Formula breakdown */}
            <div className="mt-3 font-mono text-[10px] text-zinc-500 bg-ink-900/80 p-2.5 rounded border border-white/10 leading-relaxed overflow-x-auto whitespace-nowrap">
              <div>
                ({compact(inputTokens)} × ${selectedModel.input}/M) +
                ({compact(outputTokens)} × ${selectedModel.output}/M) +
              </div>
              <div>
                ({compact(cacheWriteTokens)} × ${selectedModel.cacheWrite}/M) +
                ({compact(cacheReadTokens)} × ${selectedModel.cacheRead}/M)
              </div>
              <div className="mt-1 border-t border-white/10 pt-1 text-zinc-400">
                = {usd(calculateCost())}
              </div>
            </div>
            {selectedModel.note && (
              <p className="mt-2 text-[10px] text-zinc-500">{selectedModel.name}: {selectedModel.note}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
