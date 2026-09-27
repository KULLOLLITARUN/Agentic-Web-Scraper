import React, { useState } from 'react';
import { Copy, Download, Terminal, Search, Table as TableIcon, Code2, Check } from 'lucide-react';

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

  const renderHighlightedJson = (val) => {
    if (!val) return null;
    const jsonStr = typeof val === 'string' ? val : JSON.stringify(val, null, 2);

    const formatted = jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = 'text-white';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'text-[#ff9e00] font-bold';
            } else {
              cls = 'text-[#00ff88]';
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-[#00d8ff] font-bold';
          } else if (/null/.test(match)) {
            cls = 'text-[#788094] italic';
          } else {
            cls = 'text-white font-mono';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );

    return <pre dangerouslySetInnerHTML={{ __html: formatted }} className="font-mono text-xs leading-relaxed select-text p-3 bg-[#050608]" />;
  };

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
    "schema_description": "${(schema || '').replace(/"/g, '\\"')}",\\
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
    return data.filter(item => 
      JSON.stringify(item).toLowerCase().includes(query)
    );
  }, [data, filterText]);

  const items = Array.isArray(filteredData) ? filteredData : (filteredData ? [filteredData] : []);
  const tableHeaders = items.length > 0 && typeof items[0] === 'object' && items[0] !== null 
    ? Object.keys(items[0]) 
    : [];

  return (
    <div className="h-full flex flex-col bg-[#07080b] select-none text-[#ededed]">
      {/* Header Deck */}
      <div className="h-10 px-4 flex items-center justify-between border-b-2 border-[#1c1e26] bg-[#0c0e14]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#00ff88]" />
          <span className="font-mono text-xs font-black tracking-widest text-white uppercase">
            OUTPUT // DATA BUFFER
          </span>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1 text-[10px] font-mono font-black border transition-all ${
              activeTab === 'table'
                ? 'bg-[#ff9e00] text-black border-[#ff9e00]'
                : 'bg-[#141620] text-[#788094] border-[#222634] hover:text-white'
            }`}
          >
            TABLE VIEW
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1 text-[10px] font-mono font-black border transition-all ${
              activeTab === 'raw'
                ? 'bg-[#ff9e00] text-black border-[#ff9e00]'
                : 'bg-[#141620] text-[#788094] border-[#222634] hover:text-white'
            }`}
          >
            RAW JSON
          </button>
        </div>
      </div>

      {/* Filter & Metric Bar */}
      <div className="h-9 px-4 bg-[#0e1017] border-b border-[#1c1e26] flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search size={12} className="text-[#555c70]" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search records or filter keys..."
            className="w-full bg-transparent text-xs font-mono text-white placeholder-[#454c60] outline-none"
          />
          {filterText && (
            <button 
              onClick={() => setFilterText('')} 
              className="text-[9px] font-mono font-bold text-[#555c70] hover:text-white transition-colors"
            >
              [RESET]
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-[#788094] font-bold">COMPILED RECORDS:</span>
          <span className="bg-[#141620] border border-[#222634] text-white font-black px-1.5 py-0.5 tabular-nums">
            {items.length}
          </span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-auto p-4 bg-[#050608]">
        {error ? (
          <div className="p-4 border-2 border-[#ff3355] bg-[#ff3355]/10 text-xs font-mono text-[#ff3355] space-y-2">
            <div className="font-black uppercase tracking-wider flex items-center gap-2">
              <span>⚠ PIPELINE EXECUTION FAULT</span>
            </div>
            <p className="text-white whitespace-pre-wrap">{error}</p>
          </div>
        ) : !data && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[#454c60] gap-2 select-none">
            <Terminal size={32} className="opacity-30 text-[#ff9e00]" />
            <span className="text-xs font-mono font-black tracking-widest text-[#788094] uppercase">
              AWAITING EXTRACTION DISPATCH
            </span>
            <span className="text-[11px] font-mono text-[#454c60]">
              Configure target URL & click Run Extraction Sequence
            </span>
          </div>
        ) : isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[#ff9e00] gap-3">
            <div className="w-8 h-8 border-4 border-[#ff9e00] border-t-transparent rounded-none animate-spin" />
            <span className="text-xs font-mono font-black tracking-widest uppercase animate-pulse">
              STREAMING & AUDITING ENTITIES...
            </span>
          </div>
        ) : activeTab === 'raw' ? (
          <div className="border border-[#1c1e26] overflow-x-auto select-text">
            {renderHighlightedJson(filteredData)}
          </div>
        ) : (
          <div className="border border-[#1c1e26] overflow-x-auto select-text bg-[#08090d]">
            {tableHeaders.length === 0 ? (
              <div className="p-4 text-xs font-mono text-[#555c70] italic">
                Payload format does not contain tabular records.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b-2 border-[#1c1e26] bg-[#0f1118] text-[#788094]">
                    <th className="py-2.5 px-3 w-12 text-[#454c60] font-black">#</th>
                    {tableHeaders.map((h) => (
                      <th key={h} className="py-2.5 px-3 text-[#ff9e00] font-black tracking-wider uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181a24]">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#12141c] transition-colors">
                      <td className="py-2.5 px-3 text-[#555c70] font-black tabular-nums">{idx + 1}</td>
                      {tableHeaders.map((h) => {
                        const cellVal = row[h];
                        
                        // Render lists as high-contrast neon badges
                        if (Array.isArray(cellVal)) {
                          return (
                            <td key={h} className="py-2.5 px-3 max-w-sm">
                              <div className="flex flex-wrap gap-1">
                                {cellVal.map((tag, tIdx) => (
                                  <span 
                                    key={tIdx} 
                                    className="px-1.5 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/40 text-[#00ff88] text-[10px] font-bold"
                                  >
                                    {String(tag)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          );
                        }

                        const displayVal = typeof cellVal === 'object' && cellVal !== null 
                          ? JSON.stringify(cellVal) 
                          : String(cellVal ?? '');

                        return (
                          <td key={h} className="py-2.5 px-3 text-white whitespace-pre-wrap max-w-xs truncate">
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="h-10 px-4 border-t-2 border-[#1c1e26] bg-[#0c0e14] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyJson}
            disabled={!data}
            className="h-7 px-3 bg-[#11131a] hover:bg-[#181b24] border border-[#222634] hover:border-[#ff9e00] text-white disabled:opacity-30 disabled:hover:border-[#222634] flex items-center gap-1.5 transition-all font-mono text-[10px] font-bold active:translate-y-[1px]"
          >
            {copied ? <Check size={12} className="text-[#00ff88]" /> : <Copy size={12} className="text-[#ff9e00]" />}
            <span>{copied ? 'COPIED' : 'COPY JSON'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!data || !Array.isArray(data)}
            className="h-7 px-3 bg-[#11131a] hover:bg-[#181b24] border border-[#222634] hover:border-[#ff9e00] text-white disabled:opacity-30 disabled:hover:border-[#222634] flex items-center gap-1.5 transition-all font-mono text-[10px] font-bold active:translate-y-[1px]"
          >
            <Download size={12} className="text-[#ff9e00]" />
            <span>EXPORT CSV</span>
          </button>
        </div>

        <button
          onClick={handleCopyCurl}
          className="h-7 px-3 bg-[#11131a] hover:bg-[#181b24] border border-[#222634] hover:border-[#ff9e00] text-[#8890a4] hover:text-white flex items-center gap-1.5 transition-all font-mono text-[10px] font-bold active:translate-y-[1px]"
          title="Copy equivalent cURL request"
        >
          <Terminal size={12} className="text-[#ff9e00]" />
          <span>{curlCopied ? 'cURL COPIED' : 'COPY cURL'}</span>
        </button>
      </div>
    </div>
  );
}
