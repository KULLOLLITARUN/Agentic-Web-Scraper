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
        /("(\u[a-zA-Z0-9]{4}|\[^u]|[^\"])*"(\s*:)?|(true|false|null)|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = 'text-[#e6e8ee]';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'text-[#f59e0b] font-medium';
            } else {
              cls = 'text-[#10b981]';
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-[#38bdf8] font-semibold';
          } else if (/null/.test(match)) {
            cls = 'text-[#717789] italic';
          } else {
            cls = 'text-[#cbd0df] font-mono';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );

    return <pre dangerouslySetInnerHTML={{ __html: formatted }} className="font-mono text-xs leading-relaxed select-text" />;
  };

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = () => {
    const curlCmd = `curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "${url || 'https://quotes.toscrape.com'}",
    "schema_description": "${(schema || '').replace(/"/g, '\"')}",
    "max_retries": 3
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
    a.download = `scraped_payload_${Date.now()}.csv`;
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
    <div className="h-full flex flex-col bg-[#0b0c10] select-none text-[#ededed]">
      {/* Header Deck */}
      <div className="h-9 px-3.5 flex items-center justify-between border-b border-[#1f222d] bg-[#07080b]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#10b981] rounded-[1px]" />
          <span className="font-mono text-[10px] font-bold tracking-widest text-[#cbd0df] uppercase">
            OUTPUT_INSPECTOR // BUFFER
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('table')}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] flex items-center gap-1.5 transition-all border ${
              activeTab === 'table'
                ? 'bg-[#181a24] text-[#f59e0b] border-[#f59e0b]/50 shadow-[0_0_8px_rgba(245,158,11,0.15)] font-bold'
                : 'text-[#717789] hover:text-[#ededed] border-transparent'
            }`}
          >
            <TableIcon size={11} />
            BENTO_TABLE
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] flex items-center gap-1.5 transition-all border ${
              activeTab === 'raw'
                ? 'bg-[#181a24] text-[#f59e0b] border-[#f59e0b]/50 shadow-[0_0_8px_rgba(245,158,11,0.15)] font-bold'
                : 'text-[#717789] hover:text-[#ededed] border-transparent'
            }`}
          >
            <Code2 size={11} />
            RAW_JSON
          </button>
        </div>
      </div>

      {/* Filter & Metric Bar */}
      <div className="h-8 px-3.5 bg-[#0e0f14] border-b border-[#1f222d] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search size={11} className="text-[#454a58]" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search records or filter keys..."
            className="w-full bg-transparent text-[11px] font-mono text-[#e6e8ee] placeholder-[#454a58] outline-none"
          />
          {filterText && (
            <button 
              onClick={() => setFilterText('')} 
              className="text-[9px] font-mono text-[#555a68] hover:text-[#ededed] transition-colors"
            >
              [RESET]
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-[#717789]">
          <span>RECORD_COUNT:</span>
          <span className="text-[#e6e8ee] font-bold tabular-nums border border-[#1f222d] px-1 rounded-[2px] bg-[#12131a]">
            {items.length}
          </span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-auto p-3.5 bg-[#07080a] studio-grid">
        {error ? (
          <div className="p-3.5 border border-[#ff3355]/40 bg-[#ff3355]/10 rounded-[2px] text-xs font-mono text-[#ff3355] space-y-1.5">
            <div className="font-bold uppercase tracking-wider flex items-center gap-2 text-[11px]">
              <span>[!] PIPELINE_EXECUTION_FAULT</span>
            </div>
            <p className="text-[#e6e8ee] text-[11px] leading-relaxed whitespace-pre-wrap">{error}</p>
          </div>
        ) : !data && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[#454a58] gap-2 select-none">
            <Terminal size={24} className="opacity-40" />
            <span className="text-[11px] font-mono tracking-widest text-[#717789] uppercase">
              AWAITING_INPUT_DISPATCH
            </span>
            <span className="text-[10px] font-mono text-[#454a58]">
              Target URL & schema configured. Press Ctrl+Enter to trigger pipeline.
            </span>
          </div>
        ) : isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[#f59e0b] gap-2.5">
            <div className="w-5 h-5 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] font-mono tracking-widest uppercase animate-pulse">
              EXTRACTING_&_VALIDATING...
            </span>
          </div>
        ) : activeTab === 'raw' ? (
          <div className="overflow-x-auto select-text p-2 bg-[#0c0d12] border border-[#1f222d] rounded-[2px]">
            {renderHighlightedJson(filteredData)}
          </div>
        ) : (
          <div className="overflow-x-auto select-text bg-[#0c0d12] border border-[#1f222d] rounded-[2px]">
            {tableHeaders.length === 0 ? (
              <div className="p-3 text-[11px] font-mono text-[#555a68] italic">
                Payload structure does not conform to array of entities.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-[#1f222d] bg-[#12131a] text-[#717789]">
                    <th className="py-2 px-2.5 w-10 text-[#454a58] font-bold">#</th>
                    {tableHeaders.map((h) => (
                      <th key={h} className="py-2 px-2.5 text-[#f59e0b] font-bold tracking-wider uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181a24]">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#151722] transition-colors">
                      <td className="py-2 px-2.5 text-[#454a58] tabular-nums font-bold">{idx + 1}</td>
                      {tableHeaders.map((h) => {
                        const cellVal = row[h];
                        
                        // Render lists/arrays as crisp micro-tags
                        if (Array.isArray(cellVal)) {
                          return (
                            <td key={h} className="py-2 px-2.5 max-w-sm">
                              <div className="flex flex-wrap gap-1">
                                {cellVal.map((tag, tIdx) => (
                                  <span 
                                    key={tIdx} 
                                    className="px-1 py-0.2 bg-[#191b26] border border-[#252838] text-[#a0a6b8] text-[9px] rounded-[2px]"
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
                          <td key={h} className="py-2 px-2.5 text-[#e6e8ee] whitespace-pre-wrap max-w-xs truncate">
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
      <div className="h-9 px-3.5 border-t border-[#1f222d] bg-[#07080b] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyJson}
            disabled={!data}
            className="h-6 px-2.5 rounded-[2px] border border-[#1f222d] hover:border-[#f59e0b] hover:bg-[#12131c] text-[#cbd0df] disabled:opacity-30 disabled:hover:border-[#1f222d] disabled:hover:bg-transparent flex items-center gap-1.5 transition-all font-mono text-[10px]"
          >
            {copied ? <Check size={11} className="text-[#10b981]" /> : <Copy size={11} className="text-[#717789]" />}
            <span>{copied ? 'COPIED' : 'COPY_JSON'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!data || !Array.isArray(data)}
            className="h-6 px-2.5 rounded-[2px] border border-[#1f222d] hover:border-[#f59e0b] hover:bg-[#12131c] text-[#cbd0df] disabled:opacity-30 disabled:hover:border-[#1f222d] disabled:hover:bg-transparent flex items-center gap-1.5 transition-all font-mono text-[10px]"
          >
            <Download size={11} className="text-[#717789]" />
            <span>EXPORT_CSV</span>
          </button>
        </div>

        <button
          onClick={handleCopyCurl}
          className="h-6 px-2.5 rounded-[2px] border border-[#1f222d] hover:border-[#f59e0b] hover:bg-[#12131c] text-[#717789] hover:text-[#cbd0df] flex items-center gap-1.5 transition-all font-mono text-[10px]"
          title="Copy equivalent cURL request"
        >
          <Terminal size={11} />
          <span>{curlCopied ? 'cURL_COPIED' : 'COPY_cURL'}</span>
        </button>
      </div>
    </div>
  );
}
