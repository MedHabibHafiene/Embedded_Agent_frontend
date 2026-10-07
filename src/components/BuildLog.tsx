import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal, Copy, Check, Maximize2, Minimize2, Download } from 'lucide-react';
import './BuildLog.css';

interface BuildLogProps {
  logs: string[];
  autoScroll?: boolean;
  maxHeight?: number;
  showControls?: boolean;
  title?: string;
}

export function BuildLog({
  logs,
  autoScroll = true,
  maxHeight = 400,
  showControls = true,
  title = 'Build & Flash Logs',
}: BuildLogProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [fullscreen, setFullscreen] = useState(false);
  const [follow, setFollow] = useState(autoScroll);

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current && follow) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [follow]);

  useEffect(() => {
    scrollToBottom();
  }, [logs.length, scrollToBottom]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    const lower = log.toLowerCase();
    if (filter === 'error') return lower.includes('error') || lower.includes('failed') || lower.includes('fatal');
    if (filter === 'warning') return lower.includes('warning') || lower.includes('warn');
    if (filter === 'info') return lower.includes('info') || lower.includes('debug') || lower.includes('success') || lower.includes('ok');
    return true;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `build-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const classifyLog = (log: string): string => {
    const lower = log.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal')) return 'error';
    if (lower.includes('warning') || lower.includes('warn')) return 'warning';
    if (lower.includes('success') || lower.includes(' ok ') || lower.includes('done') || lower.match(/^\s*\[\s*ok\s*\]/i)) return 'success';
    if (lower.includes('info') || lower.includes('debug') || lower.includes('trace')) return 'debug';
    return 'info';
  };

  if (logs.length === 0) {
    return (
      <div className={`build-log ${fullscreen ? 'fullscreen' : ''}`} style={{ maxHeight: fullscreen ? 'none' : maxHeight }}>
        <div className="log-header">
          <div className="header-left">
            <Terminal className="icon" aria-hidden="true" />
            <span className="title">{title}</span>
            <span className="badge badge-neutral">Empty</span>
          </div>
          <div className="header-right">
            {showControls && (
              <>
                <button
                  className="icon-btn"
                  onClick={() => setFullscreen(!fullscreen)}
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 className="icon" /> : <Maximize2 className="icon" />}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="log-empty">
          <Terminal className="icon" aria-hidden="true" />
          <p>No logs yet</p>
          <span className="hint">Logs will appear during build and flash operations</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`build-log ${fullscreen ? 'fullscreen' : ''}`} style={{ maxHeight: fullscreen ? 'none' : maxHeight }}>
      <div className="log-header">
        <div className="header-left">
          <Terminal className="icon" aria-hidden="true" />
          <span className="title">{title}</span>
          <span className={`badge ${logs.some(l => l.toLowerCase().includes('error')) ? 'badge-error' : 'badge-success'}`}>
            {logs.some(l => l.toLowerCase().includes('error')) ? 'Errors' : 'OK'}
          </span>
          <span className="badge badge-neutral">{logs.length} lines</span>
        </div>
        <div className="header-right">
          {showControls && (
            <>
              <div className="filter-select">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="input input-sm"
                  aria-label="Filter logs"
                >
                  <option value="all">All</option>
                  <option value="error">Errors</option>
                  <option value="warning">Warnings</option>
                  <option value="info">Info</option>
                </select>
              </div>
              <label className="follow-toggle" title={follow ? 'Disable auto-scroll' : 'Enable auto-scroll'}>
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => setFollow(e.target.checked)}
                />
                <span className="toggle-label">Follow</span>
              </label>
              <button
                className="icon-btn"
                onClick={handleCopy}
                aria-label={copied ? 'Copied!' : 'Copy all logs'}
                title={copied ? 'Copied!' : 'Copy all logs'}
              >
                {copied ? <Check className="icon success" /> : <Copy className="icon" />}
              </button>
              <button
                className="icon-btn"
                onClick={handleDownload}
                aria-label="Download logs"
                title="Download logs"
              >
                <Download className="icon" />
              </button>
              <button
                className="icon-btn"
                onClick={() => setFullscreen(!fullscreen)}
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {fullscreen ? <Minimize2 className="icon" /> : <Maximize2 className="icon" />}
              </button>
            </>
          )}
        </div>
      </div>
      <div
        ref={logContainerRef}
        className="log-content"
        role="log"
        aria-live={follow ? 'polite' : 'off'}
        aria-label="Build logs"
      >
        {filteredLogs.map((log, index) => (
          <div
            key={index}
            className={`log-line ${classifyLog(log)}`}
            data-line={index + 1}
          >
            <span className="line-number">{index + 1}</span>
            <span className="line-content">{log}</span>
          </div>
        ))}
        {follow && <div className="scroll-anchor" />}
      </div>
      {filteredLogs.length < logs.length && (
        <div className="filter-notice">
          Showing {filteredLogs.length} of {logs.length} lines ·{' '}
          <button onClick={() => setFilter('all')} className="link">Show all</button>
        </div>
      )}
    </div>
  );
}