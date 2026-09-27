import React, { useState } from 'react';
import { Download, Copy, Check, Search, Code, Table as TableIcon } from 'lucide-react';

export default function DataDeck({
  data,
  url,
  isLoading
}) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  if (!data && !isLoading) return null;

  const items = Array.isArray(data) 
    ? data 
    : data && typeof data === 'object' 
      ? [data] 
      : [];

  const headers = items.length > 0 ? Object.keys(items[0]) : [];

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(item).some((val) => 
      String(val).toLowerCase().includes(q)
    );
  });

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headerRow = headers.join(',');
    const rows = items.map(item => 
      headers.map(h => {
        let val = item[h];
        if (Array.isArray(val)) val = val.join('; ');
        val = String(val ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    );
    const csvContent = [headerRow, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_data_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4">
      <div className="bg-white dark:bg-[#111216] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-studio-card overflow-hidden">
        
        {/* Controls Toolbar */}
        <div className="p-3 sm:p-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none"
            />
          </div>

          {/* View Toggles & Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <TableIcon size={14} />
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'json'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Raw JSON View"
              >
                <Code size={14} />
              </button>
            </div>

            {/* Copy JSON */}
            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'JSON'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95 transition-all shadow-xs"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Content Deck */}
        <div className="overflow-x-auto max-h-[480px]">
          {viewMode === 'table' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="py-2.5 px-3 border-b border-black/[0.06] dark:border-white/[0.06] w-10 text-center font-mono">
                    #
                  </th>
                  {headers.map((h) => (
                    <th key={h} className="py-2.5 px-3 border-b border-black/[0.06] dark:border-white/[0.06] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-neutral-400 font-mono text-center text-[10px]">
                      {idx + 1}
                    </td>
                    {headers.map((h) => {
                      const val = item[h];
                      return (
                        <td key={h} className="py-2.5 px-3 text-neutral-800 dark:text-neutral-200">
                          {Array.isArray(val) ? (
                            <div className="flex flex-wrap gap-1">
                              {val.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : typeof val === 'boolean' ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                              val ? 'text-emerald-600 bg-emerald-500/10' : 'text-neutral-500 bg-neutral-500/10'
                            }`}>
                              {String(val)}
                            </span>
                          ) : (
                            <span className="line-clamp-2 max-w-sm">
                              {String(val ?? '')}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="p-4 text-xs font-mono text-neutral-800 dark:text-neutral-200 overflow-x-auto leading-relaxed">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
