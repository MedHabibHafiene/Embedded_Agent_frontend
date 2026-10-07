import { AlertTriangle, AlertCircle, X, Cpu, Zap } from 'lucide-react';
import type { HardwareState, PortInfo } from '../types/firmware';
import { BOARD_CONFIG, LED_COLORS, pinNameFor } from '../types/firmware';
import './FlashConfirmationDialog.css';

interface FlashConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called only when the user explicitly confirms — triggers POST /api/flash. */
  onConfirm: (port: string | undefined) => void;
  hardwareState: HardwareState | null;
  code: string | null;
  jobId: string | null;
  ports: PortInfo[];
  /** Pre-selected port ('' = let PlatformIO auto-detect). */
  selectedPort: string;
  onPortChange: (port: string) => void;
  pending: boolean;
}

export function FlashConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  hardwareState,
  code,
  jobId,
  ports,
  selectedPort,
  onPortChange,
  pending,
}: FlashConfirmationDialogProps) {
  if (!isOpen) return null;

  const gpioCount = hardwareState?.gpio.length || 0;
  const peripheralCount = hardwareState ? Object.keys(hardwareState.peripherals).length : 0;
  const clock = hardwareState?.clock;
  const sysclk =
    clock && clock.sysclk_mhz !== undefined && clock.sysclk_mhz !== 'Unknown'
      ? `${clock.sysclk_mhz} MHz`
      : 'Unknown';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="flash-dialog-title">
      <div className="modal flash-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header warning">
          <div className="header-icon">
            <AlertTriangle className="icon" aria-hidden="true" />
          </div>
          <h2 id="flash-dialog-title" className="modal-title">Confirm Flash Operation</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X className="icon" />
          </button>
        </div>

        <div className="modal-content">
          <div className="warning-banner">
            <AlertCircle className="icon" aria-hidden="true" />
            <div>
              <strong>This will replace the firmware on your STM32F4-Discovery board.</strong>
              <p>The current program on the MCU will be overwritten. Ensure the board is connected via ST-LINK and no other debugger is attached.</p>
            </div>
          </div>

          <div className="confirmation-checklist">
            <h3>Pre-flash Checklist</h3>
            <ul>
              <li>
                <label>
                  <input type="checkbox" readOnly checked={true} />
                  <span>STM32F4-Discovery connected via ST-LINK</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" readOnly checked={true} />
                  <span>Target MCU: {BOARD_CONFIG.mcu}</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" readOnly checked={!!code} />
                  <span>Firmware generated successfully ({code?.length || 0} chars)</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" readOnly checked={gpioCount > 0} />
                  <span>GPIO configured: {gpioCount} inits</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" readOnly checked={peripheralCount > 0} />
                  <span>Peripherals configured: {peripheralCount}</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" readOnly checked={!!clock} />
                  <span>Clock: {sysclk} SYSCLK</span>
                </label>
              </li>
            </ul>
          </div>

          {hardwareState && (
            <div className="hardware-preview">
              <h3>Hardware Impact</h3>
              <div className="preview-grid">
                <div className="preview-item">
                  <h4>LEDs Affected</h4>
                  <div className="led-preview">
                    {Object.entries(BOARD_CONFIG.leds).map(([label, pin]) => {
                      const gpio = hardwareState.gpio.find(g =>
                        g.pin_names.includes(pinNameFor(pin))
                      );
                      const color = LED_COLORS[pin] || '#888';
                      return (
                        <div key={pin} className={`led-preview-item ${gpio ? 'active' : 'inactive'}`}>
                          <div
                            className="led-dot"
                            style={{
                              background: gpio ? color : 'transparent',
                              boxShadow: gpio ? `0 0 8px ${color}` : 'none',
                              borderColor: gpio ? color : 'var(--border-primary)',
                            }}
                          />
                          <span className="led-preview-label">{label}</span>
                          <span className="led-preview-pin">{pin}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="preview-item">
                  <h4>User Button</h4>
                  <div className="button-preview">
                    <div className="button-dot" />
                    <span>{BOARD_CONFIG.userButton}</span>
                    {hardwareState.gpio.find(g =>
                      g.pin_names.includes(pinNameFor(BOARD_CONFIG.userButton))
                    ) ? (
                      <span className="badge badge-success">Configured</span>
                    ) : (
                      <span className="badge badge-neutral">Not used</span>
                    )}
                  </div>
                </div>
                {clock && (
                  <div className="preview-item">
                    <h4>Clock</h4>
                    <div className="clock-preview">
                      <div><span>SYSCLK</span> <strong>{sysclk}</strong></div>
                      <div><span>Source</span> <strong>{clock.source || 'Unknown'}</strong></div>
                      <div>
                        <span>PLL</span>
                        <strong>
                          M={clock.PLLM || '?'} · N={clock.PLLN || '?'} · P={clock.PLLP || '?'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="port-selection">
            <label htmlFor="flash-port-select">Upload port</label>
            <select
              id="flash-port-select"
              className="input"
              value={selectedPort}
              onChange={e => onPortChange(e.target.value)}
              disabled={pending}
            >
              <option value="">Auto-detect (recommended)</option>
              {ports.map((port) => (
                <option key={port.device ?? port.description} value={port.device ?? ''}>
                  {port.device}
                  {port.st_link ? ' (ST-LINK)' : ''} — {port.description || port.hwid}
                </option>
              ))}
            </select>
            {ports.length === 0 && (
              <span className="hint">No serial ports detected — PlatformIO will auto-detect.</span>
            )}
          </div>

          {jobId && (
            <div className="job-info">
              <Cpu className="icon" aria-hidden="true" />
              <span>Job ID: <code>{jobId}</code></span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={pending}
          >
            <X className="icon" />
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onConfirm(selectedPort || undefined)}
            disabled={pending}
          >
            {pending ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                Flashing...
              </>
            ) : (
              <>
                <Zap className="icon" />
                Flash Firmware
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
