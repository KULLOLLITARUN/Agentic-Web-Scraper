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
  const [activeTab, setActiveTab] = useState('raw');
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
          let cls = 'text-[#ededed]';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'text-[#f59e0b] font-medium';
            } else {
              cls = 'text-[#10b981]';
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-[#38bdf8] font-semibold';
          } else if (/null/.test(match)) {
            cls = 'text-[#8a8f98] italic';
          } else {
            cls = 'text-[#e2e8f0] font-mono';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );

    return <pre dangerouslySetInnerHTML={{ __html: formatted }} className="font-mono text-xs leading-relaxed" />;
  };

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = () => {
    const curlCmd = `curl -X POST http://localhost:8000/scrape \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "url": "${url || 'https://quotes.toscrape.com'}",\n    "schema_description": "${(schema || '').replace(/"/g, '\\"')}",\n    "max_retries": 3\n  }'`;
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
    a.download = `scraped_data_${Date.now()}.csv`;
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
    <div className="h-full flex flex-col bg-[#111215] select-none">
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#24262e] bg-[#0d0e11]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#10b981] rounded-sharp" />
          <span className="text-xs font-bold tracking-widest text-[#ededed] uppercase">
            LIVE INSPECTOR & OUTPUT
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-2.5 py-1 text-xs font-mono rounded-sharp flex items-center gap-1.5 transition-colors ${
              activeTab === 'raw'
                ? 'bg-[#16181d] text-[#f59e0b] border border-[#24262e] border-b-[#f59e0b]'
                : 'text-[#8a8f98] hover:text-[#ededed]'
            }`}
          >
            <Code2 size={12} />
            RAW JSON
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`px-2.5 py-1 text-xs font-mono rounded-sharp flex items-center gap-1.5 transition-colors ${
              activeTab === 'table'
                ? 'bg-[#16181d] text-[#f59e0b] border border-[#24262e] border-b-[#f59e0b]'
                : 'text-[#8a8f98] hover:text-[#ededed]'
            }`}
          >
            <TableIcon size={12} />
            TABLE VIEW
          </button>
        </div>
      </div>

      <div className="h-9 px-4 bg-[#16181d] border-b border-[#24262e] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search size={12} className="text-[#525866]" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter output fields or values..."
            className="w-full bg-transparent text-xs font-mono text-[#ededed] placeholder-[#525866] outline-none"
          />
          {filterText && (
            <button onClick={() => setFilterText('')} className="text-[10px] text-[#525866] hover:text-[#ededed]">
              CLEAR
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[#8a8f98]">
          <span>RECORD COUNT: <strong className="text-[#ededed] tabular-nums">{items.length}</strong></span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-[#0d0e11]">
        {error ? (
          <div className="p-4 border border-[#ef4444]/40 bg-[#ef4444]/10 rounded-sharp text-xs font-mono text-[#ef4444] space-y-2">
            <div className="font-bold uppercase tracking-wider flex items-center gap-2">
              <span>⚠ PIPELINE RUNTIME ERROR</span>
            </div>
            <p className="text-[#ededed] whitespace-pre-wrap">{error}</p>
          </div>
        ) : !data && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[#525866] gap-2 select-none">
            <Terminal size={28} className="opacity-40" />
            <span className="text-xs font-mono tracking-wider">AWAITING EXTRACTION TRIGGER</span>
            <span className="text-[11px] text-[#525866]">Execute extraction sequence on the left control deck</span>
          </div>
        ) : isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[#f59e0b] gap-3">
            <div className="w-6 h-6 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono tracking-wider animate-pulse">STREAMING DATA BLUEPRINT...</span>
          </div>
        ) : activeTab === 'raw' ? (
          <div className="overflow-x-auto select-text">
            {renderHighlightedJson(filteredData)}
          </div>
        ) : (
          <div className="overflow-x-auto select-text">
            {tableHeaders.length === 0 ? (
              <div className="text-xs text-[#525866] italic">Data is not an array of objects to format as table.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#24262e] bg-[#16181d] text-[#8a8f98]">
                    <th className="py-2 px-3 w-10 text-[#525866]">#</th>
                    {tableHeaders.map((h) => (
                      <th key={h} className="py-2 px-3 text-[#f59e0b] font-medium tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24262e]">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#16181d]/50 transition-colors">
                      <td className="py-2 px-3 text-[#525866]">{idx + 1}</td>
                      {tableHeaders.map((h) => {
                        const cellVal = row[h];
                        const displayVal = typeof cellVal === 'object' && cellVal !== null 
                          ? JSON.stringify(cellVal) 
                          : String(cellVal ?? '');

                        return (
                          <td key={h} className="py-2 px-3 text-[#ededed] whitespace-pre-wrap max-w-xs truncate">
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

      <div className="h-11 px-4 border-t border-[#24262e] bg-[#0d0e11] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyJson}
            disabled={!data}
            className="h-7 px-3 rounded-sharp border border-[#24262e] hover:border-[#f59e0b] hover:bg-[#16181d] text-[#ededed] disabled:opacity-40 disabled:hover:border-[#24262e] disabled:hover:bg-transparent flex items-center gap-1.5 transition-colors font-mono text-[11px]"
          >
            {copied ? <Check size={12} className="text-[#10b981]" /> : <Copy size={12} className="text-[#8a8f98]" />}
            <span>{copied ? 'COPIED' : 'COPY JSON'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!data || !Array.isArray(data)}
            className="h-7 px-3 rounded-sharp border border-[#24262e] hover:border-[#f59e0b] hover:bg-[#16181d] text-[#ededed] disabled:opacity-40 disabled:hover:border-[#24262e] disabled:hover:bg-transparent flex items-center gap-1.5 transition-colors font-mono text-[11px]"
          >
            <Download size={12} className="text-[#8a8f98]" />
            <span>EXPORT CSV</span>
          </button>
        </div>

        <button
          onClick={handleCopyCurl}
          className="h-7 px-3 rounded-sharp border border-[#24262e] hover:border-[#f59e0b] hover:bg-[#16181d] text-[#8a8f98] hover:text-[#ededed] flex items-center gap-1.5 transition-colors font-mono text-[11px]"
          title="Copy equivalent cURL command"
        >
          <Terminal size={12} className="text-[#8a8f98]" />
          <span>{curlCopied ? 'cURL COPIED!' : 'COPY cURL'}</span>
        </button>
      </div>
    </div>
  );
}
