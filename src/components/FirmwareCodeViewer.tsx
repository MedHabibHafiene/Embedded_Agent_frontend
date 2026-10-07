import { useState, useCallback, useRef } from 'react';
import { Copy, Check, Download, X, Maximize2, Minimize2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { HardwareState } from '../types/firmware';
import './FirmwareCodeViewer.css';

interface FirmwareCodeViewerProps {
  code: string | null | undefined;
  hardwareState: HardwareState | null | undefined;
  jobId: string | null | undefined;
  onCopy: () => void;
  onDownload: () => void;
  onClose?: () => void;
}

/** Let long register names (RCC_OSCILLATORTYPE_HSE) wrap at underscores. */
function breakable(value: string): string {
  return value.replace(/_/g, '_​');
}

export function FirmwareCodeViewer({
  code,
  hardwareState,
  jobId,
  onCopy,
  onDownload,
  onClose,
}: FirmwareCodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewerHeight, setViewerHeight] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Textarea-style height drag from the grip below the component.
  const onGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const el = viewerRef.current;
      if (!el) return;
      const startY = e.clientY;
      const startH = el.getBoundingClientRect().height;
      const onMove = (ev: MouseEvent) => {
        const next = startH + (ev.clientY - startY);
        setViewerHeight(Math.max(220, Math.min(next, window.innerHeight - 100)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    []
  );

  const handleCopy = useCallback(() => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  if (!code) {
    return (
      <div className="code-viewer empty">
        <div className="empty-state">
          <X className="icon" aria-hidden="true" />
          <p>No firmware generated yet</p>
          <span className="hint">Submit a command to generate C code</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewerRef}
      className={`code-viewer ${fullscreen ? 'fullscreen' : ''}`}
      style={viewerHeight !== null && !fullscreen ? { height: viewerHeight } : undefined}
    >
      <div className="code-viewer-header">
        <div className="header-left">
          {onClose && (
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close code viewer"
              title="Close"
            >
              <X className="icon" aria-hidden="true" />
            </button>
          )}
          <div className="file-info">
            <span className="file-name">main.c</span>
            {jobId && <span className="job-id">Job: {jobId.slice(0, 8)}...</span>}
          </div>
        </div>
        <div className="header-right">
          <div className="hardware-badges">
            {hardwareState?.gpio.map((gpio, index) => (
              <span key={gpio.port + '-' + index} className="gpio-badge" title={gpio.pins}>
                <span className="gpio-pin-name">{gpio.pin_names.join(', ') || gpio.port}</span>
                <span className="gpio-mode">{gpio.mode}</span>
              </span>
            ))}
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              {copied ? <Check className="icon success" aria-hidden="true" /> : <Copy className="icon" aria-hidden="true" />}
            </button>
            <button
              className="icon-btn"
              onClick={onDownload}
              aria-label="Download firmware"
              title="Download .c file"
            >
              <Download className="icon" aria-hidden="true" />
            </button>
            <button
              className="icon-btn"
              onClick={() => setFullscreen(!fullscreen)}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="icon" aria-hidden="true" /> : <Maximize2 className="icon" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
      <div className="code-viewer-content" role="region" aria-label="Generated C code">
        <SyntaxHighlighter
          language="c"
          style={atomDark}
          customStyle={{
            fontSize: '13px',
            lineHeight: '1.6',
            fontFamily: 'var(--font-mono)',
            background: '#0d1117',
            padding: '16px',
          }}
          showLineNumbers={true}
          lineNumberStyle={{
            color: 'var(--text-muted)',
            backgroundColor: 'transparent',
            paddingRight: '16px',
            borderRight: '1px solid var(--border-primary)',
            minWidth: '40px',
            textAlign: 'right',
            userSelect: 'none',
          }}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
        {hardwareState && (
        <div className="hardware-summary">
          <div className="summary-section">
            <h4>Clock Configuration</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">SYSCLK</span>
                <span className="summary-value">
                  {hardwareState.clock.sysclk_mhz !== undefined && hardwareState.clock.sysclk_mhz !== 'Unknown'
                    ? `${hardwareState.clock.sysclk_mhz} MHz`
                    : 'Unknown'}
                </span>
              </div>
              {(['hclk_mhz', 'pclk1_mhz', 'pclk2_mhz', 'usb_mhz'] as const).map((key) =>
                typeof hardwareState.clock[key] === 'number' ? (
                  <div className="summary-item" key={key}>
                    <span className="summary-label">{key.replace('_mhz', '').toUpperCase()}</span>
                    <span className="summary-value">{hardwareState.clock[key]} MHz</span>
                  </div>
                ) : null
              )}
              {(['PLLM', 'PLLN', 'PLLP', 'PLLQ'] as const).map((key) =>
                hardwareState.clock[key] ? (
                  <div className="summary-item" key={key}>
                    <span className="summary-label">{key}</span>
                    <span className="summary-value">{hardwareState.clock[key]}</span>
                  </div>
                ) : null
              )}
              {hardwareState.clock.source && (
                <div className="summary-item">
                  <span className="summary-label">Source</span>
                  <span className={`summary-value ${hardwareState.clock.source.length > 12 ? 'long' : ''}`}>
                    {breakable(hardwareState.clock.source)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="summary-section">
            <h4>Configured Peripherals</h4>
            <div className="peripherals-list">
              {Object.keys(hardwareState.peripherals).length === 0 && (
                <span className="peripheral-badge">None detected</span>
              )}
              {Object.entries(hardwareState.peripherals).map(([name, params]) => (
                <span key={name} className="peripheral-badge">
                  {name.toUpperCase()}
                  {Object.keys(params).length > 0 && (
                    <span className="peripheral-config">
                      {Object.entries(params)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
      {!fullscreen && (
        <div
          className="resize-grip"
          onMouseDown={onGripMouseDown}
          onDoubleClick={() => setViewerHeight(null)}
          title="Drag to resize · double-click to reset"
        >
          <span />
        </div>
      )}
    </div>
  );
}