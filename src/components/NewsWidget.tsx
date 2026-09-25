import React, { useState } from 'react';
import { NewsItem, TickerConfig } from '../types/options';
import { Newspaper, Flame, ExternalLink, Filter, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface NewsWidgetProps {
  news: NewsItem[];
  selectedTicker: TickerConfig;
  onSelectTickerBySymbol?: (symbol: string) => void;
}

export const NewsWidget: React.FC<NewsWidgetProps> = ({
  news,
  selectedTicker,
  onSelectTickerBySymbol,
}) => {
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [filterTickerOnly, setFilterTickerOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredNews = news.filter(item => {
    if (filterSentiment !== 'ALL' && item.sentiment !== filterSentiment) return false;
    if (filterTickerOnly && !item.relatedTickers.includes(selectedTicker.symbol)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.optionTakeaway.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Options Market News & Macro Catalysts</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time feed evaluated for Implied Volatility shifts, institutional flow, and CE/PE implications
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Ticker specific toggle */}
          <button
            onClick={() => setFilterTickerOnly(!filterTickerOnly)}
            className={`px-2.5 py-1 rounded font-medium border transition-colors cursor-pointer ${
              filterTickerOnly
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {selectedTicker.symbol} Only
          </button>

          {/* Sentiment Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(sentiment => (
              <button
                key={sentiment}
                onClick={() => setFilterSentiment(sentiment)}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  filterSentiment === sentiment
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sentiment === 'ALL' ? 'All Sentiments' : sentiment}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News List */}
      <div className="divide-y divide-slate-800/70 mt-3">
        {filteredNews.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No news matching your filter criteria.
          </div>
        ) : (
          filteredNews.map(item => {
            const isBull = item.sentiment === 'BULLISH';
            const isBear = item.sentiment === 'BEARISH';
            const isHighImpact = item.impact === 'HIGH';

            return (
              <div key={item.id} className="py-4 first:pt-2 last:pb-2">
                {/* Meta Header - Zero-Pill discipline: unboxed text with separators */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-semibold text-slate-300">{item.source}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-400">{item.timeAgo}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.category}</span>
                    {isHighImpact && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-400" /> High Market Impact
                        </span>
                      </>
                    )}
                  </div>

                  {/* Sentiment & Related Tickers */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                      isBull ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' :
                      isBear ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60' :
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {item.sentiment}
                    </span>

                    <div className="flex items-center gap-1">
                      {item.relatedTickers.map(sym => (
                        <button
                          key={sym}
                          onClick={() => onSelectTickerBySymbol && onSelectTickerBySymbol(sym)}
                          className="text-[11px] font-mono text-slate-400 hover:text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 transition-colors cursor-pointer"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Headline */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white leading-snug hover:text-emerald-300 transition-colors">
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1.5">
                        <span>{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 inline" />
                      </a>
                    ) : (
                      item.title
                    )}
                  </h4>
                </div>

                {/* News Summary */}
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {item.summary}
                </p>

                {/* Options Takeaway Box: Exactly explains why it affects CE or PE */}
                <div className="mt-2.5 p-2.5 rounded bg-slate-950/80 border border-slate-800/90 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
                    {isBull ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isBear ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                    <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
                      Options Trading Takeaway (CE vs PE Impact):
                    </span>
                  </div>
                  <p className="text-slate-300 leading-normal pl-4 border-l border-emerald-500/30">
                    {item.optionTakeaway}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
