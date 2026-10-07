import { useMemo } from 'react';
import { Cpu, Zap, Wifi, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import type { HardwareState, BoardConfig } from '../types/firmware';
import { BOARD_CONFIG, LED_COLORS, pinNameFor } from '../types/firmware';
import './HardwareStatePanel.css';

interface HardwareStatePanelProps {
  hardwareState: HardwareState | null;
  boardConfig?: BoardConfig;
  fullscreen?: boolean;
  onFullscreenChange?: (value: boolean) => void;
  onClose?: () => void;
  /** Live ST-LINK port from GET /api/ports, if one was detected. */
  stLinkPort?: string | null;
}

function formatSysclk(value: number | 'Unknown' | undefined): string {
  if (value === undefined || value === 'Unknown') return 'Unknown';
  return `${value} MHz`;
}

/** Let long register names (RCC_OSCILLATORTYPE_HSE) wrap at underscores. */
function breakable(value: string): string {
  return value.replace(/_/g, '_​');
}

export function HardwareStatePanel({
  hardwareState,
  boardConfig = BOARD_CONFIG,
  fullscreen = false,
  onFullscreenChange,
  onClose,
  stLinkPort,
}: HardwareStatePanelProps) {
  const button = useMemo(() => {
    if (!hardwareState) return null;
    const pinName = pinNameFor(boardConfig.userButton);
    return hardwareState.gpio.find((g) => g.pin_names.includes(pinName)) || null;
  }, [hardwareState, boardConfig.userButton]);

  const peripherals = useMemo(() => {
    if (!hardwareState) return [];
    return Object.entries(hardwareState.peripherals);
  }, [hardwareState]);

  const clock = hardwareState?.clock;

  if (!hardwareState) {
    return (
      <div className="hardware-panel empty">
        <div className="empty-state">
          <Cpu className="icon" aria-hidden="true" />
          <p>No hardware configuration</p>
          <span className="hint">Generate firmware to see hardware state</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`hardware-panel ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="panel-header">
        <div className="header-left">
          {onClose && (
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close hardware panel"
            >
              <RotateCcw className="icon" />
            </button>
          )}
          <h3 className="panel-title">Hardware Configuration</h3>
          <span className="board-badge">{boardConfig.board} · {boardConfig.mcu}</span>
        </div>
        <div className="header-right">
          {onFullscreenChange && (
            <button
              className="icon-btn"
              onClick={() => onFullscreenChange(!fullscreen)}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="icon" /> : <Maximize2 className="icon" />}
            </button>
          )}
        </div>
      </div>

      <div className="panel-content">
        <div className="hardware-grid">
          <section className="section leds-section">
            <h4 className="section-title">
              <span className="section-icon" style={{ color: '#00ff00' }}>●</span>
              LEDs
            </h4>
            <div className="leds-grid">
              {Object.entries(boardConfig.leds).map(([label, pin]) => {
                const gpio = hardwareState.gpio.find((g) =>
                  g.pin_names.includes(pinNameFor(pin))
                );
                const isConfigured = !!gpio;
                const ledColor = LED_COLORS[pin] || '#888';
                return (
                  <div key={pin} className={`led-card ${isConfigured ? 'configured' : 'unconfigured'}`}>
                    <div
                      className="led-visual"
                      style={{
                        background: isConfigured ? ledColor : 'transparent',
                        boxShadow: isConfigured ? `0 0 12px ${ledColor}` : 'none',
                      }}
                    >
                      <span className="led-pin">{pin}</span>
                    </div>
                    <div className="led-info">
                      <span className="led-label">{label}</span>
                      <span className="led-pin-label">{pin}</span>
                      {isConfigured && (
                        <span className="led-mode">{breakable(gpio.mode)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section button-section">
            <h4 className="section-title">
              <span className="section-icon" style={{ color: '#ffaa00' }}>●</span>
              User Button
            </h4>
            <div className="button-card">
              <div className="button-visual">
                <span className="button-pin">{boardConfig.userButton}</span>
              </div>
              <div className="button-info">
                <span className="button-label">User Button</span>
                <span className="button-pin-label">{boardConfig.userButton}</span>
                {button ? <span className="button-mode">{button.mode}</span> : (
                  <span className="button-mode">not configured</span>
                )}
              </div>
            </div>
          </section>

          <section className="section clock-section">
            <h4 className="section-title">
              <Zap className="section-icon" aria-hidden="true" />
              Clock Tree
            </h4>
            {clock && (
              <>
              <div className="clock-grid">
                <div className="clock-item">
                  <span className="clock-label">SYSCLK</span>
                  <span className="clock-value">{formatSysclk(clock.sysclk_mhz)}</span>
                </div>
                {clock.hclk_mhz !== undefined && (
                  <div className="clock-item">
                    <span className="clock-label">HCLK</span>
                    <span className="clock-value">{clock.hclk_mhz} MHz</span>
                  </div>
                )}
                {clock.pclk1_mhz !== undefined && (
                  <div className="clock-item">
                    <span className="clock-label">APB1</span>
                    <span className="clock-value">{clock.pclk1_mhz} MHz</span>
                  </div>
                )}
                {clock.pclk2_mhz !== undefined && (
                  <div className="clock-item">
                    <span className="clock-label">APB2</span>
                    <span className="clock-value">{clock.pclk2_mhz} MHz</span>
                  </div>
                )}
                {clock.usb_mhz !== undefined && (
                  <div className="clock-item">
                    <span className="clock-label">USB</span>
                    <span className="clock-value">{clock.usb_mhz} MHz</span>
                  </div>
                )}
                {clock.source && (
                  <div className="clock-item">
                    <span className="clock-label">Source</span>
                    <span className={`clock-value ${clock.source.length > 14 ? 'long' : ''}`}>
                      {breakable(clock.source)}
                    </span>
                  </div>
                )}
                <div className="divider-full" />
                {(['PLLM', 'PLLN', 'PLLP', 'PLLQ'] as const).map((key) => {
                  const value = clock[key] || 'Unknown';
                  return (
                    <div className="clock-item pll" key={key}>
                      <span className="clock-label">PLL {key.slice(3)}</span>
                      <span className={`clock-value ${value.length > 14 ? 'long' : ''}`}>
                        {breakable(value)}
                      </span>
                    </div>
                  );
                })}
                {(['AHBPrescaler', 'APB1Prescaler', 'APB2Prescaler'] as const).map((key) => {
                  const value = clock[key] || 'Unknown';
                  return (
                    <div className="clock-item pll" key={key}>
                      <span className="clock-label">{key.replace('Prescaler', '')}</span>
                      <span className={`clock-value ${value.length > 14 ? 'long' : ''}`}>
                        {breakable(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {(clock.warnings || []).map((w) => (
                <div className="clock-warning" key={w}>{w}</div>
              ))}
              </>
            )}
          </section>

          <section className="section gpio-section">
            <h4 className="section-title">
              <RotateCcw className="section-icon" aria-hidden="true" />
              GPIO Configuration
            </h4>
            <div className="gpio-table-container">
              <table className="gpio-table">
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Pins</th>
                    <th>Pin Names</th>
                    <th>Mode</th>
                    <th>Pull</th>
                    <th>Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {hardwareState.gpio.map((gpio, index) => (
                    <tr key={`${gpio.port}-${index}`}>
                      <td className="pin-cell">
                        <code>{gpio.port}</code>
                      </td>
                      <td><code>{gpio.pins}</code></td>
                      <td className="names-cell">
                        {gpio.pin_names.length > 0 ? gpio.pin_names.join(', ') : '—'}
                      </td>
                      <td><span className="mode-badge">{gpio.mode}</span></td>
                      <td>{gpio.pull}</td>
                      <td>{gpio.speed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section peripherals-section">
            <h4 className="section-title">
              <Wifi className="section-icon" aria-hidden="true" />
              Configured Peripherals
            </h4>
            {peripherals.length === 0 ? (
              <div className="peripherals-empty">
                <span className="hint">No peripherals detected in the generated code</span>
              </div>
            ) : (
              <div className="peripherals-grid">
                {peripherals.map(([name, params]) => (
                  <div key={name} className="peripheral-card">
                    <div className="peripheral-header">
                      <span className="peripheral-name">{name.toUpperCase()}</span>
                      <span className="peripheral-status badge badge-success">Enabled</span>
                    </div>
                    {Object.keys(params).length > 0 && (
                      <div className="peripheral-config">
                        {Object.entries(params).map(([key, value]) => (
                          <div key={key} className="config-row">
                            <span className="config-key">{key}</span>
                            <span className="config-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section stlink-section">
            <h4 className="section-title">
              <Cpu className="section-icon" aria-hidden="true" />
              Debug Interface
            </h4>
            <div className="stlink-info">
              <div className="stlink-row">
                <span className="stlink-label">ST-LINK Port</span>
                <span className="stlink-value">{stLinkPort || 'Auto-detect'}</span>
              </div>
              <div className="stlink-row">
                <span className="stlink-label">Target MCU</span>
                <span className="stlink-value">{boardConfig.mcu}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
