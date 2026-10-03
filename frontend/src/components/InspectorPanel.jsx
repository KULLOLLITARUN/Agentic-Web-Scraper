import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Search, Table2, Braces, Check, AlertCircle, MousePointerClick } from 'lucide-react';
import { fadeUp, motion } from '../lib/motion';

const TABS = [
  { id: 'table', label: 'Table', Icon: Table2 },
  { id: 'json', label: 'JSON', Icon: Braces },
];

function Cell({ value }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11px] font-medium">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${value ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  if (value === null || value === undefined || value === '') {
    return <span className="text-faint">—</span>;
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-xs text-muted">{JSON.stringify(value)}</span>;
  }
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all line-clamp-2">
        {value}
      </a>
    );
  }
  return <span className={`line-clamp-3 ${typeof value === 'number' ? 'tabular-nums' : ''}`}>{String(value)}</span>;
}

function Skeleton() {
  const ref = useRef(null);
  useEffect(() => {
    const anim = motion(ref.current?.children, {
      opacity: [0.35, 1],
      duration: 800,
      delay: (_, i) => i * 120,
      alternate: true,
      loop: true,
      ease: 'inOutSine',
    });
    return () => anim?.pause();
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted">Scraping the page and extracting your fields…</div>
      <div ref={ref} className="card overflow-hidden divide-y divide-line">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex gap-4">
            <div className="h-3 w-6 rounded bg-subtle" />
            <div className="h-3 rounded bg-subtle" style={{ width: `${35 + ((i * 17) % 30)}%` }} />
            <div className="h-3 w-24 rounded bg-subtle ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InspectorPanel({ data, isLoading, error }) {
  const [activeTab, setActiveTab] = useState('table');
  const [filterText, setFilterText] = useState('');
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef({});
  const pillRef = useRef(null);
  const bodyRef = useRef(null);

  // Slide the tab indicator under the active tab.
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el || !pillRef.current) return;
    motion(pillRef.current, { translateX: el.offsetLeft, width: el.offsetWidth, duration: 380, ease: 'outQuart' });
  }, [activeTab]);

  // Stagger rows / content in whenever new results arrive or the view changes.
  useEffect(() => {
    if (!data || isLoading || error) return;
    const rows = bodyRef.current?.querySelectorAll('[data-row]');
    if (rows?.length) fadeUp(Array.from(rows).slice(0, 40), { step: 25, distance: 6 });
    else fadeUp(bodyRef.current?.firstElementChild);
  }, [data, activeTab, isLoading, error]);

  useEffect(() => {
    if (error) motion(bodyRef.current?.firstElementChild, { translateX: [0, -8, 8, -5, 5, 0], duration: 450, ease: 'inOutSine' });
  }, [error]);

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const csv = [
      cols.join(','),
      ...rows.map((row) =>
        cols
          .map((h) => {
            const val = row[h];
            return `"${(typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')).replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ].join('\n');
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `scraped_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const filtered = useMemo(() => {
    if (!data || !Array.isArray(data) || !filterText.trim()) return data;
    const q = filterText.toLowerCase();
    return data.filter((item) => item && typeof item === 'object' && Object.values(item).some((v) => String(v).toLowerCase().includes(q)));
  }, [data, filterText]);

  const items = Array.isArray(filtered) ? filtered : filtered ? [filtered] : [];
  const headers = items.length > 0 && typeof items[0] === 'object' ? Object.keys(items[0]) : [];
  const total = Array.isArray(data) ? data.length : data ? 1 : 0;

  let body;
  if (isLoading) {
    body = <Skeleton />;
  } else if (error) {
    body = (
      <div className="h-full min-h-[280px] grid place-items-center">
        <div className="max-w-md w-full card p-5 border-bad/30">
          <div className="flex items-center gap-2 text-bad font-medium text-sm">
            <AlertCircle size={17} /> Scrape failed
          </div>
          <p className="mt-2 text-sm text-muted break-words">{error}</p>
        </div>
      </div>
    );
  } else if (!data) {
    body = (
      <div className="h-full min-h-[300px] grid place-items-center text-center">
        <div className="flex flex-col items-center gap-3 max-w-xs">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent grid place-items-center">
            <MousePointerClick size={22} />
          </div>
          <div className="text-sm font-medium">No results yet</div>
          <p className="text-sm text-muted">
            Enter a URL, describe the fields you want, then press <span className="font-medium text-fg">Run scraper</span>.
          </p>
        </div>
      </div>
    );
  } else if (activeTab === 'json') {
    body = (
      <pre className="card p-4 overflow-auto font-mono text-[12px] leading-relaxed text-fg select-text">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  } else if (items.length === 0) {
    body = <div className="text-sm text-muted text-center py-16">No records match “{filterText}”.</div>;
  } else {
    body = (
      <>
        <div className="hidden sm:block card overflow-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-subtle text-xs text-muted">
              <tr>
                <th className="py-2.5 px-4 w-12 font-medium">#</th>
                {headers.map((h) => (
                  <th key={h} className="py-2.5 px-4 font-medium whitespace-nowrap capitalize">
                    {h.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((row, idx) => (
                <tr key={idx} data-row className="hover:bg-subtle/60 transition-colors align-top">
                  <td className="py-3 px-4 text-faint text-xs tabular-nums">{idx + 1}</td>
                  {headers.map((h) => (
                    <td key={h} className="py-3 px-4 max-w-[420px] select-text">
                      <Cell value={row[h]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden space-y-3">
          {items.map((row, idx) => (
            <div key={idx} data-row className="card p-4 space-y-2.5">
              <div className="text-xs text-faint">Record {idx + 1}</div>
              {headers.map((h) => (
                <div key={h} className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted capitalize">{h.replace(/_/g, ' ')}</span>
                  <div className="text-sm select-text">
                    <Cell value={row[h]} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-y border-line bg-surface/50">
        <div className="relative inline-flex rounded-lg bg-subtle p-0.5 border border-line">
          <span ref={pillRef} className="absolute top-0.5 bottom-0.5 left-0 rounded-md bg-surface shadow-card" style={{ width: 0 }} />
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              ref={(el) => (tabRefs.current[id] = el)}
              onClick={() => setActiveTab(id)}
              className={`relative z-10 h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === id ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {data && !isLoading && (
          <span className="text-xs text-muted mr-auto">
            {filterText && Array.isArray(data) ? `${items.length} of ${total}` : total} {total === 1 ? 'record' : 'records'}
          </span>
        )}

        <div className="flex items-center gap-2">
          {Array.isArray(data) && activeTab === 'table' && !isLoading && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter…"
                className="field h-8 py-0 pl-8 w-32 sm:w-44 text-xs"
              />
            </div>
          )}
          <button onClick={handleCopyJson} disabled={!data} className="btn-outline" title="Copy JSON">
            {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!data}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium bg-fg text-bg hover:opacity-90 transition disabled:opacity-30 disabled:pointer-events-none"
            title="Download CSV"
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-auto p-4 sm:p-6">
        {body}
      </div>
    </div>
  );
}
