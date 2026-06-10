import { useState } from 'react';
import { usd, compact } from '../lib/format';

interface ModelPrice {
  name: string;
  family: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  popular?: boolean;
}

const PRICING_DATA: ModelPrice[] = [
  { name: 'Claude Fable 5', family: 'fable', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0, popular: true },
  { name: 'Claude Mythos 5 (limited availability)', family: 'mythos', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 },
  { name: 'Claude Opus 4.8', family: 'opus-4-8', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5, popular: true },
  { name: 'Claude Opus 4.7', family: 'opus-4-7', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.6', family: 'opus-4-6', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.5', family: 'opus-4-5', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.1 (deprecated)', family: 'opus-4-1', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Opus 4 (deprecated)', family: 'opus-4', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Sonnet 4.6', family: 'sonnet-4-6', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3, popular: true },
  { name: 'Claude Sonnet 4.5', family: 'sonnet-4-5', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Sonnet 4 (deprecated)', family: 'sonnet-4', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Haiku 4.5', family: 'haiku-4-5', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1, popular: true },
  // Legacy models
  { name: 'Claude Sonnet 3.5 (Legacy)', family: 'sonnet-legacy', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Haiku 3.5 (Legacy)', family: 'haiku-3', input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
  { name: 'Claude 3 Opus (Legacy)', family: 'opus-legacy', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude 3 Haiku (Legacy)', family: 'haiku-legacy', input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.03 }
];

export function CostCalculation() {
  const [selectedModel, setSelectedModel] = useState<ModelPrice>(PRICING_DATA[0]);
  const [showLegacy, setShowLegacy] = useState(false);
  const [inputTokens, setInputTokens] = useState(100_000);
  const [outputTokens, setOutputTokens] = useState(20_000);
  const [cacheWriteTokens, setCacheWriteTokens] = useState(50_000);
  const [cacheReadTokens, setCacheReadTokens] = useState(200_000);

  const calculateCost = () => {
    return (
      (inputTokens * selectedModel.input +
        outputTokens * selectedModel.output +
        cacheWriteTokens * selectedModel.cacheWrite +
        cacheReadTokens * selectedModel.cacheRead) /
      1_000_000
    );
  };

  const currentModels = PRICING_DATA.filter((m) => m.popular);
  const legacyModels = PRICING_DATA.filter((m) => !m.popular);

  return (
    <div className="card p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Cost Calculation Explained</h2>
          <p className="text-xs text-zinc-500">
            Anthropic charges based on the number of tokens processed. Cache reads are discounted by 90%.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Pricing Table */}
        <div className="lg:col-span-7 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 font-semibold uppercase tracking-wider">
                <th className="py-2.5">Model</th>
                <th className="py-2.5 text-right">Input / 1M</th>
                <th className="py-2.5 text-right">Output / 1M</th>
                <th className="py-2.5 text-right">Cache Write / 1M</th>
                <th className="py-2.5 text-right">Cache Read / 1M</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {currentModels.map((model) => (
                <tr
                  key={model.name}
                  className={`hover:bg-white/5 transition-colors cursor-pointer ${
                    selectedModel.name === model.name ? 'bg-clay-500/10 text-clay-400 font-medium' : ''
                  }`}
                  onClick={() => setSelectedModel(model)}
                >
                  <td className="py-3 pr-2">
                    {model.name}
                  </td>
                  <td className="py-3 text-right tabular-nums">${model.input.toFixed(2)}</td>
                  <td className="py-3 text-right tabular-nums">${model.output.toFixed(2)}</td>
                  <td className="py-3 text-right tabular-nums">${model.cacheWrite.toFixed(2)}</td>
                  <td className="py-3 text-right tabular-nums">${model.cacheRead.toFixed(2)}</td>
                </tr>
              ))}
              {showLegacy &&
                legacyModels.map((model) => (
                  <tr
                    key={model.name}
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${
                      selectedModel.name === model.name ? 'bg-clay-500/10 text-clay-400 font-medium' : ''
                    }`}
                    onClick={() => setSelectedModel(model)}
                  >
                    <td className="py-3 pr-2">
                      {model.name}
                    </td>
                    <td className="py-3 text-right tabular-nums">${model.input.toFixed(2)}</td>
                    <td className="py-3 text-right tabular-nums">${model.output.toFixed(2)}</td>
                    <td className="py-3 text-right tabular-nums">${model.cacheWrite.toFixed(2)}</td>
                    <td className="py-3 text-right tabular-nums">${model.cacheRead.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-start">
            <button
              onClick={() => setShowLegacy(!showLegacy)}
              className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              {showLegacy ? 'Hide other models' : `Show other models (${legacyModels.length})`}
              <span>{showLegacy ? '▲' : '▼'}</span>
            </button>
          </div>
          
          <div className="mt-4 rounded-xl bg-ink-700/30 p-3 text-xs text-zinc-400 leading-relaxed border border-white/5">
            <span className="font-semibold text-zinc-300">💡 Prompt Caching Benefit:</span> Cache reads cost only <strong>10%</strong> of standard input price. Designing your prompts to reuse systemic instructions, codebase maps, or tool schemas leverages this pricing to achieve massive savings.
          </div>
        </div>

        {/* Right: Interactive Sandbox Calculator */}
        <div className="lg:col-span-5 flex flex-col rounded-xl bg-ink-700/50 p-5 border border-white/5">
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

            {/* Cache Write Tokens */}
            <div
              className="group cursor-pointer select-none"
              onDoubleClick={() => setCacheWriteTokens(50_000)}
              title="Double-click to reset to initial value"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">Cache Write Tokens</span>
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
                className="w-full h-1.5 bg-ink-600 rounded-lg appearance-none cursor-pointer accent-clay-500"
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
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Calculated Cost</span>
              <span className="text-xl font-bold text-clay-400 tabular-nums">{usd(calculateCost())}</span>
            </div>
            
            {/* Visual Formula breakdown */}
            <div className="mt-3 font-mono text-[10px] text-zinc-500 bg-ink-900/80 p-2.5 rounded border border-white/5 leading-relaxed overflow-x-auto whitespace-nowrap">
              <div>
                ({compact(inputTokens)} × ${selectedModel.input}/M) + 
                ({compact(outputTokens)} × ${selectedModel.output}/M) + 
              </div>
              <div>
                ({compact(cacheWriteTokens)} × ${selectedModel.cacheWrite}/M) + 
                ({compact(cacheReadTokens)} × ${selectedModel.cacheRead}/M)
              </div>
              <div className="mt-1 border-t border-white/5 pt-1 text-zinc-400">
                = {usd(calculateCost())}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
