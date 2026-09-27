import React, { useState } from 'react';
import { Copy, Download, Terminal, Search, Table as TableIcon, Code2, Check, RefreshCw } from 'lucide-react';

export default function InspectorPanel({
  data,
  url,
  schema,
  metrics,
  isLoading,
  error
}) {
  const [activeTab, setActiveTab] = useState('table');
  const [filterText, setFilterText] = useState('');
  const [copied, setCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = () => {
    const curlCmd = `curl -X POST http://localhost:8000/scrape \\
  -H "Content-Type: application/json" \\
  -d '{\\
    "url": "${url || 'https://quotes.toscrape.com'}",\\
    "instruction": "${(schema || '').replace(/"/g, '\\"')}",\\
    "max_retries": 3\\
  }'`;
    navigator.clipboard.writeText(curlCmd);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!data) return;
    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return;

    const headers = Object.keys(items[0]);
    const csvRows = [
      headers.join(','),
      ...items.map(row => 
        headers.map(h => {
          const val = row[h];
          const escaped = (typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `scraped_dataset_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const filteredData = React.useMemo(() => {
    if (!data) return null;
    if (!filterText.trim()) return data;
    if (!Array.isArray(data)) return data;

    const query = filterText.toLowerCase();
    return data.filter(item => {
      if (typeof item !== 'object' || !item) return false;
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(query)
      );
    });
  }, [data, filterText]);

  const items = Array.isArray(filteredData) ? filteredData : (filteredData ? [filteredData] : []);
  const headers = items.length > 0 ? Object.keys(items[0]) : [];

  return (
    <div className="h-full flex flex-col bg-[#07080b] select-none text-[#ededed]">
      {/* TOOLBAR */}
      <div className="h-10 px-3 sm:px-4 bg-[#0c0e14] border-b-2 border-[#1c1e26] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* TAB BUTTONS */}
          <button
            onClick={() => setActiveTab('table')}
            className={`px-2.5 py-1 text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${
              activeTab === 'table'
                ? 'bg-[#1c1e28] text-white border-[#ff9e00]'
                : 'text-[#626a80] border-transparent hover:text-white'
            }`}
          >
            <TableIcon size={12} className={activeTab === 'table' ? 'text-[#ff9e00]' : ''} />
            <span>TABLE VIEW</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`px-2.5 py-1 text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${
              activeTab === 'json'
                ? 'bg-[#1c1e28] text-white border-[#00ff88]'
                : 'text-[#626a80] border-transparent hover:text-white'
            }`}
          >
            <Code2 size={12} className={activeTab === 'json' ? 'text-[#00ff88]' : ''} />
            <span>RAW JSON</span>
          </button>
        </div>

        {/* SEARCH & ACTIONS */}
        <div className="flex items-center gap-2">
          {items.length > 0 && activeTab === 'table' && (
            <div className="relative hidden sm:block">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555c70]" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter results..."
                className="w-36 bg-[#050608] border border-[#1c1e26] pl-6 pr-2 py-0.5 text-[10px] text-white placeholder-[#383d4d] outline-none font-mono focus:border-[#ff9e00]"
              />
            </div>
          )}

          <button
            onClick={handleCopyJson}
            disabled={!data}
            className="px-2 py-1 bg-[#141620] hover:bg-[#1a1e2b] border border-[#222634] text-white font-mono text-[9px] font-bold flex items-center gap-1 transition-all active:translate-y-[1px] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Copy Raw JSON"
          >
            {copied ? <Check size={10} className="text-[#00ff88]" /> : <Copy size={10} />}
            <span className="hidden sm:inline">{copied ? 'COPIED' : 'JSON'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!data}
            className="px-2.5 py-1 bg-[#00ff88] hover:bg-[#1aff96] text-black font-mono text-[9px] font-black uppercase flex items-center gap-1 shadow-[0_2px_0_#009952] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Download CSV Dataset"
          >
            <Download size={11} strokeWidth={2.5} />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* BODY VIEWPORT */}
      <div className="flex-1 overflow-auto bg-[#050608] p-3 sm:p-4">
        {isLoading ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 text-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-[#ff9e00]/20 animate-ping" />
              <div className="w-10 h-10 border-2 border-[#ff9e00] border-t-transparent animate-spin" />
            </div>
            <div className="font-mono text-xs font-bold text-white tracking-widest uppercase">
              DISTILLING & EXTRACTING STRUCTURED PAYLOAD...
            </div>
            <div className="font-mono text-[10px] text-[#555c70]">
              Playwright headless Chromium execution in motion
            </div>
          </div>
        ) : error ? (
          <div className="h-full min-h-[250px] flex flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="text-[#ff3355] font-mono text-xs font-black uppercase tracking-wider">
              [EXTRACTION FAILURE DETECTED]
            </div>
            <div className="font-mono text-xs text-[#a0a8ba] max-w-md bg-[#12080a] p-3 border border-[#ff3355]/30">
              {error}
            </div>
          </div>
        ) : !data ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-2 text-center text-[#555c70] font-mono select-none">
            <Terminal size={28} className="opacity-30 mb-1" />
            <div className="text-xs font-bold uppercase tracking-wider text-[#788094]">
              AWAITING EXTRACTION DISPATCH
            </div>
            <div className="text-[10px] max-w-sm text-[#454b5c]">
              Select a target URL or preset from the left control panel and press RUN to extract structured data.
            </div>
          </div>
        ) : activeTab === 'table' ? (
          /* BENTO DATA TABLE WITH HORIZONTAL SCROLL & CARD RESPONSIVENESS */
          <div className="space-y-3">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto border-2 border-[#1c1e26] bg-[#08090d]">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead className="bg-[#0e1017] border-b-2 border-[#1c1e26] text-[#788094] uppercase text-[10px] tracking-wider font-black sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center border-r border-[#1c1e26]">#</th>
                    {headers.map(h => (
                      <th key={h} className="py-2.5 px-3 border-r border-[#1c1e26] whitespace-nowrap text-white">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#161822]">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#10121a] transition-colors">
                      <td className="py-2.5 px-3 text-[#555c70] text-center font-bold text-[10px] border-r border-[#1c1e26]">
                        {idx + 1}
                      </td>
                      {headers.map(h => {
                        const val = row[h];
                        return (
                          <td key={h} className="py-2.5 px-3 text-[#ededed] border-r border-[#1c1e26] align-top">
                            {Array.isArray(val) ? (
                              <div className="flex flex-wrap gap-1">
                                {val.map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-1.5 py-0.2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 text-[9px] font-mono font-bold"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : typeof val === 'boolean' ? (
                              <span className={`px-1.5 py-0.5 text-[9px] font-black border ${
                                val 
                                  ? 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]' 
                                  : 'bg-[#ff3355]/20 text-[#ff3355] border-[#ff3355]'
                              }`}>
                                {val ? 'TRUE' : 'FALSE'}
                              </span>
                            ) : (
                              <span className="line-clamp-3 select-text leading-relaxed">
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
            </div>

            {/* Mobile Card View (< 640px) */}
            <div className="sm:hidden space-y-2.5">
              {items.map((row, idx) => (
                <div key={idx} className="bg-[#0b0d13] border-2 border-[#1c1e26] p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-[#1c1e26] pb-1.5">
                    <span className="text-[10px] font-mono font-black text-[#ff9e00]">
                      RECORD #{idx + 1}
                    </span>
                  </div>
                  {headers.map(h => {
                    const val = row[h];
                    return (
                      <div key={h} className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-mono font-bold text-[#555c70] uppercase">
                          {h}:
                        </span>
                        {Array.isArray(val) ? (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {val.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-1.5 py-0.2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 text-[9px] font-mono font-bold"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-white select-text">
                            {String(val ?? '')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* RAW JSON VIEW */
          <div className="border-2 border-[#1c1e26] bg-[#040507] p-3 overflow-auto">
            <pre className="font-mono text-xs text-[#00ff88] leading-relaxed select-text">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
