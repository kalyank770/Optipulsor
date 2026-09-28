import React, { useState } from 'react';
import { NewsItem, TickerConfig } from '../types/options';
import { Newspaper, Flame, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Clock, Moon, Sun, Sparkles } from 'lucide-react';

interface NewsWidgetProps {
  news: NewsItem[];
  selectedTicker: TickerConfig;
  onSelectTickerBySymbol?: (symbol: string) => void;
  theme?: 'dark' | 'light';
  onRefreshNews?: () => void;
  isNewsLoading?: boolean;
}

export const NewsWidget: React.FC<NewsWidgetProps> = ({
  news,
  selectedTicker,
  onSelectTickerBySymbol,
  theme = 'dark',
  onRefreshNews,
  isNewsLoading = false,
}) => {
  const isLight = theme === 'light';
  const [filterTiming, setFilterTiming] = useState<'ALL' | 'LIVE' | 'OVERNIGHT'>('ALL');
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [filterTickerOnly, setFilterTickerOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const liveCount = news.filter(n => n.timing === 'LIVE').length;
  const overnightCount = news.filter(n => n.timing === 'OVERNIGHT').length;

  const bullCount = news.filter(n => n.sentiment === 'BULLISH').length;
  const bearCount = news.filter(n => n.sentiment === 'BEARISH').length;
  const overallSentiment = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';

  const filteredNews = news.filter(item => {
    if (filterTiming !== 'ALL') {
      if (filterTiming === 'LIVE' && item.timing !== 'LIVE') return false;
      if (filterTiming === 'OVERNIGHT' && item.timing !== 'OVERNIGHT') return false;
    }
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
    <div className={`border rounded-lg p-3 sm:p-5 ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800 text-white'}`}>
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 pb-4 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Newspaper className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Options Market News & Macro Catalysts
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-3 h-3 text-emerald-400" /> Last Night to Current Live Session
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border tracking-wider ${
              overallSentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
              overallSentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
              'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {overallSentiment === 'BULLISH' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : overallSentiment === 'BEARISH' ? <TrendingDown className="w-3 h-3 text-rose-400" /> : <Clock className="w-3 h-3 text-slate-400" />}
              <span>Overall: {overallSentiment}</span>
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Strictly past 24h: Overnight global cues (Gift Nifty, Wall Street, Crude, FIIs) + Live intraday breaking news affecting CE & PE strikes
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onRefreshNews && (
            <button
              onClick={onRefreshNews}
              disabled={isNewsLoading}
              title="Refresh latest news wire from last night to current moment"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                isNewsLoading
                  ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isNewsLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isNewsLoading ? 'Fetching Wire...' : 'Refresh Wire'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 pb-1 text-xs">
        {/* Timing Scope Tabs: ALL vs LIVE vs OVERNIGHT */}
        <div className={`flex items-center gap-1 p-1 rounded border overflow-x-auto no-scrollbar max-w-full ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'}`}>
          <button
            onClick={() => setFilterTiming('ALL')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors cursor-pointer min-h-[30px] ${
              filterTiming === 'ALL'
                ? isLight ? 'bg-white text-slate-900 font-bold shadow-xs' : 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>All ({news.length})</span>
          </button>

          <button
            onClick={() => setFilterTiming('LIVE')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors cursor-pointer min-h-[30px] ${
              filterTiming === 'LIVE'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <Sun className="w-3 h-3 text-emerald-400" />
            <span>Live Today ({liveCount})</span>
          </button>

          <button
            onClick={() => setFilterTiming('OVERNIGHT')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors cursor-pointer min-h-[30px] ${
              filterTiming === 'OVERNIGHT'
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-bold'
                : 'text-slate-400 hover:text-indigo-300'
            }`}
          >
            <Moon className="w-3 h-3 text-indigo-400" />
            <span>Last Night ({overnightCount})</span>
          </button>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
          {/* Ticker specific toggle */}
          <button
            onClick={() => setFilterTickerOnly(!filterTickerOnly)}
            className={`px-2.5 py-1 rounded font-medium border whitespace-nowrap transition-colors cursor-pointer min-h-[30px] ${
              filterTickerOnly
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300 font-semibold'
                : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {selectedTicker.symbol} Only
          </button>

          {/* Sentiment Filter */}
          <div className={`flex items-center gap-1 p-1 rounded border overflow-x-auto no-scrollbar ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'}`}>
            {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(sentiment => (
              <button
                key={sentiment}
                onClick={() => setFilterSentiment(sentiment)}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  filterSentiment === sentiment
                    ? isLight ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'bg-slate-800 text-white font-semibold'
                    : isLight ? 'text-slate-700 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
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
            const isOvernight = item.timing === 'OVERNIGHT';

            const exactTimeStr = item.formattedPubTime || (item.timestamp ? (new Date(item.timestamp).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }) + ' IST') : '');

            return (
              <div key={item.id} className="py-4 first:pt-2 last:pb-2">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-slate-400">
                    {/* Timing Badge: LIVE vs OVERNIGHT */}
                    {isOvernight ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                        <Moon className="w-2.5 h-2.5 text-indigo-400" /> Overnight Cue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 animate-pulse">
                        <Sun className="w-2.5 h-2.5 text-emerald-400" /> Live Intraday
                      </span>
                    )}

                    <span className="font-semibold text-slate-300">{item.source}</span>
                    <span aria-hidden="true">·</span>
                    {exactTimeStr && (
                      <>
                        <span className="font-mono text-slate-200 font-medium flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                          <Clock className="w-3 h-3 text-emerald-400 inline" />
                          <span>{exactTimeStr}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span className="font-mono text-emerald-400 font-semibold">{item.timeAgo}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">{item.category}</span>
                    {isHighImpact && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-400" /> High Option Impact
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

                {/* Options Takeaway Box: Directly explains why it affects CE or PE */}
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
