import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle, XCircle, X, Zap, ShieldCheck, Microchip
} from 'lucide-react';
import { BackendStatus } from '../components/BackendStatus';
import { CommandEditor } from '../components/CommandEditor';
import { FirmwareCodeViewer } from '../components/FirmwareCodeViewer';
import { HardwareStatePanel } from '../components/HardwareStatePanel';
import { OperationProgress } from '../components/OperationProgress';
import { BuildLog } from '../components/BuildLog';
import { FlashConfirmationDialog } from '../components/FlashConfirmationDialog';
import { FirmwareHistory } from '../components/FirmwareHistory';
import { ChatPanel, type ChatUiMessage } from '../components/ChatPanel';
import { generateFirmware, flashFirmware, verifyFirmware } from '../api/firmware';
import { listPorts } from '../api/ports';
import { listJobs } from '../api/jobs';
import { listChatSessions, getChatSession, deleteChatSession, sendChatMessage } from '../api/chat';
import { setApiBaseUrl, ApiError } from '../api/client';
import type {
  OperationState,
  HardwareState,
  JobSummary,
  JobDetail,
  PortInfo,
  ChatSessionSummary,
} from '../types/firmware';
import { BOARD_CONFIG, LED_COLORS, pinNameFor } from '../types/firmware';
import './FirmwareAgentPage.css';

const SETTINGS_KEY = 'stm32-agent-settings-v2';

interface Settings {
  autoConfirm: boolean;
  backendUrl: string;
  theme: 'dark' | 'light';
  notifications: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  autoConfirm: false,
  backendUrl: '', // empty = same-origin via the Vite dev proxy
  theme: 'dark',
  notifications: true,
};

export function FirmwareAgentPage() {
  // Firmware operation state
  const [command, setCommand] = useState('');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('');
  const [operationProgress, setOperationProgress] = useState<number | undefined>(undefined);
  const [operationLogs, setOperationLogs] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [hardwareState, setHardwareState] = useState<HardwareState | null>(null);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  /** Compile-check outcome of the current job; undefined = unknown (e.g. loaded from history). */
  const [buildOk, setBuildOk] = useState<boolean | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);

  // Flash flow: the confirmation dialog is shown BEFORE the board is written.
  const [showFlashDialog, setShowFlashDialog] = useState(false);
  const [flashPort, setFlashPort] = useState('');
  const [ports, setPorts] = useState<PortInfo[]>([]);

  // Documentation chat. When the backend has a MongoDB chat log, the server
  // stores every turn and `chatSessionId` makes the stored history the source
  // of truth; otherwise the client-side `chatMessages` history is resent.
  const [chatMessages, setChatMessages] = useState<ChatUiMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [chatSessionsError, setChatSessionsError] = useState<string | null>(null);

  // Server-side job history (GET /api/jobs)
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hardwareFullscreen, setHardwareFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'hardware' | 'logs' | 'chat' | 'history'>('code');

  const refreshJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const list = await listJobs();
      setJobs(list);
      setJobsError(null);
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Load settings, then jobs + serial ports on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(savedSettings) as Partial<Settings>) });
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    void refreshJobs();
    listPorts().then(setPorts).catch(() => setPorts([]));
  }, [refreshJobs]);

  // Save settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }, [settings]);

  // The Backend URL setting actually retargets the API client
  useEffect(() => {
    setApiBaseUrl(settings.backendUrl);
  }, [settings.backendUrl]);

  const addLog = useCallback((log: string) => {
    setOperationLogs(prev => [...prev, log]);
  }, []);

  const appendLogs = useCallback((logs: string | null | undefined) => {
    if (!logs) return;
    const lines = logs.split('\n').filter(l => l.trim());
    if (lines.length > 0) setOperationLogs(prev => [...prev, ...lines]);
  }, []);

  const setState = useCallback((state: OperationState, message: string, progress?: number) => {
    setOperationState(state);
    setOperationMessage(message);
    if (progress !== undefined) setOperationProgress(progress);
  }, []);

  const resetOperation = useCallback(() => {
    setOperationState('idle');
    setOperationMessage('');
    setOperationProgress(undefined);
    setOperationLogs([]);
    setOperationError(null);
    setIsProcessing(false);
  }, []);

  // ---------------------------------------------------------------- flash
  const doFlash = useCallback(async (id: string, port?: string) => {
    setState('flashing', 'Flashing board via ST-LINK...');
    addLog('[INFO] Starting flash operation...' + (port ? ` (port ${port})` : ' (auto-detect)'));
    try {
      const response = await flashFirmware({
        id,
        confirmed: true,
        ...(port ? { port } : {}),
      });
      appendLogs(response.logs);
      // SOFT FAIL: upload failures come back as HTTP 200 with status "error".
      if (response.status === 'error') {
        const message = 'Flash failed — see the Build Logs tab for the PlatformIO output.';
        setOperationError(message);
        setState('error', message);
        addLog('[ERROR] Flash failed');
      } else {
        addLog('[SUCCESS] Flash completed successfully');
        setState('success', 'Firmware flashed to the board successfully.');
      }
      void refreshJobs();
    } catch (error) {
      // Real HTTP errors: 404 unknown job, 400 not confirmed, 500 BuildError.
      const message = error instanceof Error ? error.message : 'Flash failed';
      if (error instanceof ApiError && error.data && typeof error.data === 'object'
        && 'logs' in (error.data as Record<string, unknown>)) {
        appendLogs(String((error.data as { logs: unknown }).logs));
      }
      setOperationError(message);
      setState('error', message);
      addLog('[ERROR] ' + message);
      void refreshJobs();
    }
  }, [setState, addLog, appendLogs, refreshJobs]);

  // Open the flash confirmation dialog and refresh the port list for its picker.
  const promptFlashConfirmation = useCallback(async () => {
    setShowFlashDialog(true);
    try {
      const list = await listPorts();
      setPorts(list);
    } catch {
      setPorts([]); // picker falls back to PlatformIO auto-detect
    }
  }, []);

  // ---------------------------------------------------------------- generate
  const handleGenerate = useCallback(async () => {
    const prompt = command.trim();
    if (!prompt || isProcessing) return;

    setIsProcessing(true);
    resetOperation();
    setGeneratedCode(null);
    setHardwareState(null);
    setJobId(undefined);
    setBuildOk(undefined);

    try {
      setState('connecting', 'Connecting to backend...');
      addLog('[INFO] Connecting to backend...');
      setState('generating', 'Generating & compiling firmware — this can take several minutes...');
      addLog('[INFO] Prompt sent: ' + prompt);
      addLog('[INFO] Waiting for LLM generation + PlatformIO compile check...');

      // verify=true (the backend default) returns the compile outcome in
      // `build`. Compile failures are a SOFT FAIL: HTTP 200, build.status
      // "error" — they must not be reported as success.
      const response = await generateFirmware({ prompt, verify: true });

      setGeneratedCode(response.code);
      setHardwareState(response.hardware_state);
      setJobId(response.id);

      if (response.build) {
        appendLogs(response.build.logs);
        if (response.build.status === 'error') {
          setBuildOk(false);
          const message = 'Compilation failed — see the Build Logs tab for the PlatformIO output.';
          setOperationError(message);
          setState('error', message);
          addLog('[ERROR] PlatformIO compile check failed');
          void refreshJobs();
          return; // never flash firmware that failed to compile
        }
        setBuildOk(true);
        addLog('[SUCCESS] PlatformIO compile check passed');
      } else {
        addLog('[INFO] Response carried no compile check — run Verify before flashing.');
      }

      setState('success', 'Firmware compiled successfully — ready to flash.');
      void refreshJobs();

      if (settings.autoConfirm) {
        addLog('[INFO] Auto-confirm on — flashing without confirmation dialog...');
        await doFlash(response.id, undefined);
      } else {
        // Ask the user BEFORE writing to the board.
        addLog('[INFO] Compilation finished — waiting for flash confirmation.');
        await promptFlashConfirmation();
      }
    } catch (error) {
      // Real HTTP errors: 503 setup problem, 502 LLM failure, 500 internal.
      const message = error instanceof Error ? error.message : 'Unknown error';
      setOperationError(message);
      setState('error', message);
      addLog('[ERROR] ' + message);
      void refreshJobs();
    } finally {
      setIsProcessing(false);
    }
  }, [command, isProcessing, settings.autoConfirm, resetOperation, setState, addLog, appendLogs, refreshJobs, doFlash, promptFlashConfirmation]);

  const startFlash = useCallback(async () => {
    if (!jobId || isProcessing) return;
    if (settings.autoConfirm) {
      setIsProcessing(true);
      try {
        await doFlash(jobId, flashPort || undefined);
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    // Refresh the port list for the picker, then ask BEFORE touching hardware.
    await promptFlashConfirmation();
  }, [jobId, isProcessing, settings.autoConfirm, flashPort, doFlash, promptFlashConfirmation]);

  const confirmFlash = useCallback(async (port?: string) => {
    setShowFlashDialog(false);
    if (!jobId) return;
    setIsProcessing(true);
    try {
      await doFlash(jobId, port);
    } finally {
      setIsProcessing(false);
    }
  }, [jobId, doFlash]);

  // ---------------------------------------------------------------- verify
  const handleVerify = useCallback(async () => {
    if (!jobId || isProcessing) return;
    setIsProcessing(true);
    setOperationError(null);
    setState('compiling', 'Compile-checking firmware with PlatformIO...');
    addLog('[INFO] Starting PlatformIO compile check...');
    try {
      const result = await verifyFirmware({ id: jobId });
      appendLogs(result.logs);
      if (result.status === 'error') {
        setBuildOk(false);
        const message = 'Compilation failed — see the Build Logs tab.';
        setOperationError(message);
        setState('error', message);
      } else {
        setBuildOk(true);
        setState('success', 'Firmware verified — it compiles cleanly and is ready to flash.');
      }
      void refreshJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      setOperationError(message);
      setState('error', message);
      addLog('[ERROR] ' + message);
    } finally {
      setIsProcessing(false);
    }
  }, [jobId, isProcessing, setState, addLog, appendLogs, refreshJobs]);

  // ---------------------------------------------------------------- chat
  const refreshChatSessions = useCallback(async () => {
    try {
      setChatSessions(await listChatSessions());
      setChatSessionsError(null);
    } catch (e) {
      // 503 = chat log not configured on the backend; not a UI error, the
      // chat just runs stateless.
      setChatSessions([]);
      setChatSessionsError(
        e instanceof ApiError && e.status === 503
          ? null
          : e instanceof Error ? e.message : 'Failed to load chat sessions'
      );
    }
  }, []);

  useEffect(() => {
    // Refresh the session list whenever the chat tab becomes visible, so
    // sessions created/deleted elsewhere show up on return.
    if (activeTab === 'chat') {
      refreshChatSessions();
    }
  }, [activeTab, refreshChatSessions]);

  const handleSendChat = useCallback(async (message: string) => {
    if (chatLoading) return;
    setChatError(null);
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setChatLoading(true);
    try {
      // With a session id the server uses its stored history; otherwise the
      // stateless fallback needs the full client-side history (oldest first).
      const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(message, history, chatSessionId ?? undefined);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.answer, sources: response.sources },
      ]);
      // First turn of a new conversation: adopt the session the backend created.
      if (!chatSessionId && response.session_id) {
        setChatSessionId(response.session_id);
      }
      refreshChatSessions();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Chat request failed');
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages, chatLoading, chatSessionId, refreshChatSessions]);

  const handleLoadChatSession = useCallback(async (sessionId: string) => {
    setChatError(null);
    setChatLoading(true);
    try {
      const session = await getChatSession(sessionId);
      setChatSessionId(session.id);
      setChatMessages(session.messages.map(m => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
      })));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to load conversation');
    } finally {
      setChatLoading(false);
    }
  }, []);

  const handleDeleteChatSession = useCallback(async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      if (chatSessionId === sessionId) {
        setChatSessionId(null);
        setChatMessages([]);
      }
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to delete conversation');
    }
  }, [chatSessionId]);

  const handleNewChat = useCallback(() => {
    setChatMessages([]);
    setChatError(null);
    setChatSessionId(null);
  }, []);

  // ---------------------------------------------------------------- history
  const handleLoadJob = useCallback((detail: JobDetail) => {
    setCommand(detail.command);
    setGeneratedCode(detail.code);
    setHardwareState(detail.hardware_state);
    setJobId(detail.id);
    setBuildOk(undefined); // unknown — run Verify to check
    setOperationLogs(detail.logs ? detail.logs.split('\n').filter(Boolean) : []);
    setOperationState('idle');
    setOperationMessage('');
    setOperationProgress(undefined);
    setOperationError(detail.error);
    setIsProcessing(false);
    setActiveTab('code');
  }, []);

  const handleCopyCode = useCallback(() => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
    }
  }, [generatedCode]);

  const handleDownloadCode = useCallback(() => {
    if (generatedCode) {
      const blob = new Blob([generatedCode], { type: 'text/x-c' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `main-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.c`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [generatedCode]);

  const isGenerating = ['connecting', 'retrieving_context', 'generating', 'validating', 'compiling', 'flashing'].includes(operationState);
  const stLinkPort = ports.find(p => p.st_link)?.device ?? null;

  return (
    <div className="firmware-agent-page">
      <header className="page-header">
        <div className="header-left">
          <div className="logo">
            <Microchip size={28} strokeWidth={1.8} aria-hidden="true" />
            <span className="title">STM32 Firmware Agent</span>
          </div>
          <span className="board-badge">{BOARD_CONFIG.board} · {BOARD_CONFIG.mcu}</span>
        </div>
        <div className="header-right">
          <div className="header-actions">
            <BackendStatus pollingInterval={15000} />
          </div>
        </div>
      </header>

      <main className="page-main">
        <div className="main-grid">
          {/* Left Panel: Command & Progress */}
          <aside className="left-panel">
            <section className="panel command-panel">
              <CommandEditor
                value={command}
                onChange={setCommand}
                onSubmit={() => handleGenerate()}
                disabled={isGenerating}
                operationState={operationState}
                autoConfirm={settings.autoConfirm}
                onAutoConfirmChange={value => setSettings(s => ({ ...s, autoConfirm: value }))}
                onFlash={startFlash}
                canFlash={!!jobId && !isProcessing}
              />
            </section>

            <section className="panel progress-panel">
              <OperationProgress
                state={operationState}
                message={operationMessage}
                progress={operationProgress}
                logs={operationLogs}
                error={operationError}
                jobId={jobId as string | undefined}
                onRetry={handleGenerate}
                onDismissError={() => setOperationError(null)}
              />

              {/* Job actions — available whenever a job is loaded and idle */}
              {jobId && generatedCode && !isProcessing && (
                <div className="job-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleVerify}
                    disabled={isProcessing}
                    title="Compile-check the generated firmware with PlatformIO (no flashing)"
                  >
                    <ShieldCheck className="icon" aria-hidden="true" />
                    Verify
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={startFlash}
                    disabled={isProcessing || buildOk === false}
                    title={
                      buildOk === false
                        ? 'Disabled: the last compile check failed — fix and regenerate first'
                        : 'Upload the firmware to the board via ST-LINK'
                    }
                  >
                    <Zap className="icon" aria-hidden="true" />
                    Flash Firmware
                  </button>
                </div>
              )}
            </section>
          </aside>

          {/* Center Panel: Code / Hardware / Logs / Chat / History tabs */}
          <section className="center-panel">
            <div className="tabs">
              <button
                className={`tab tab-source ${activeTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveTab('code')}
                disabled={!generatedCode && activeTab !== 'code'}
              >
                Source Code
                {generatedCode && <span className="tab-badge">{generatedCode.length} chars</span>}
              </button>
              <button
                className={`tab tab-hardware ${activeTab === 'hardware' ? 'active' : ''}`}
                onClick={() => setActiveTab('hardware')}
                disabled={!hardwareState && activeTab !== 'hardware'}
              >
                Hardware
                {hardwareState && <span className="tab-badge">{hardwareState.gpio.length} GPIO</span>}
              </button>
              <button
                className={`tab tab-logs ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                Build Logs
                {operationLogs.length > 0 && <span className="tab-badge">{operationLogs.length}</span>}
              </button>
              <button
                className={`tab tab-chat ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Docs Chat
                {chatMessages.length > 0 && <span className="tab-badge">{chatMessages.length}</span>}
              </button>
              <button
                className={`tab tab-jobs ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Jobs
                {jobs.length > 0 && <span className="tab-badge">{jobs.length}</span>}
              </button>
            </div>

            <div className="tab-content">
              {activeTab === 'code' && (
                <FirmwareCodeViewer
                  code={generatedCode}
                  hardwareState={hardwareState}
                  jobId={jobId as string | undefined}
                  onCopy={handleCopyCode}
                  onDownload={handleDownloadCode}
                />
              )}

              {activeTab === 'hardware' && (
                <HardwareStatePanel
                  hardwareState={hardwareState}
                  boardConfig={BOARD_CONFIG}
                  fullscreen={hardwareFullscreen}
                  onFullscreenChange={setHardwareFullscreen}
                  stLinkPort={stLinkPort}
                />
              )}

              {activeTab === 'logs' && (
                <BuildLog
                  logs={operationLogs}
                  autoScroll={isGenerating}
                  maxHeight={500}
                  showControls={true}
                  title="Build & Flash Logs"
                />
              )}

              {activeTab === 'chat' && (
                <ChatPanel
                  messages={chatMessages}
                  loading={chatLoading}
                  error={chatError}
                  onSend={handleSendChat}
                  onClear={handleNewChat}
                  sessions={chatSessions}
                  sessionsError={chatSessionsError}
                  activeSessionId={chatSessionId}
                  onLoadSession={handleLoadChatSession}
                  onDeleteSession={handleDeleteChatSession}
                />
              )}

              {activeTab === 'history' && (
                <FirmwareHistory
                  jobs={jobs}
                  loading={jobsLoading}
                  error={jobsError}
                  onRefresh={() => void refreshJobs()}
                  onLoadJob={handleLoadJob}
                />
              )}
            </div>
          </section>

          {/* Right Panel: Hardware Quick View & Board Info */}
          <aside className="right-panel">
            <section className="panel hardware-quick-panel">
              <div className="panel-header">
                <h3 className="panel-title">Board: STM32F4-Discovery</h3>
                <button
                  className="icon-btn"
                  onClick={() => { setActiveTab('hardware'); setHardwareFullscreen(true); }}
                  aria-label="Open hardware panel"
                  title="Fullscreen"
                >
                  <span style={{fontSize: '14px'}}>⛶</span>
                </button>
              </div>
              <div className="panel-content">
                <div className="quick-leds">
                  {Object.entries(BOARD_CONFIG.leds).map(([label, pin]) => {
                    const gpio = hardwareState?.gpio.find(g =>
                      g.pin_names.includes(pinNameFor(pin))
                    );
                    const color = LED_COLORS[pin as keyof typeof LED_COLORS] || '#888';
                    return (
                      <div
                        key={pin}
                        className={`quick-led ${gpio ? 'active' : ''}`}
                        title={`${label} (${pin})${gpio ? ` - ${gpio.mode}` : ' - not configured'}`}
                      >
                        <div
                          className="quick-led-dot"
                          style={{
                            background: gpio ? color : 'transparent',
                            boxShadow: gpio ? `0 0 10px ${color}` : 'none',
                            borderColor: gpio ? color : 'var(--border-primary)',
                          }}
                        />
                        <span className="quick-led-label">{label.charAt(0)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="divider" />
                <div className="quick-info">
                  <div className="info-row">
                    <span className="info-label">MCU</span>
                    <span className="info-value">{BOARD_CONFIG.mcu}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">User Button</span>
                    <span className="info-value">{BOARD_CONFIG.userButton}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">ST-LINK</span>
                    <span className="info-value">{stLinkPort || 'Auto-detect'}</span>
                  </div>
                  <div className="divider" />
                  <div className="info-row used-pins-heading">
                    <span className="info-label">Used Pins</span>
                  </div>
                  {hardwareState && hardwareState.gpio.length > 0 ? (
                    hardwareState.gpio.map(gpio => {
                      // The hardware-state parser stores short pin names
                      // ("D15"); normalize back to board style ("PD15").
                      const raw = gpio.pin_names[0] ?? gpio.port;
                      const pin = raw.startsWith('P') ? raw : `P${raw}`;
                      const ledName = Object.entries(BOARD_CONFIG.leds).find(([, p]) => p === pin)?.[0];
                      const label = ledName
                        ? `${ledName.charAt(0).toUpperCase()}${ledName.slice(1)} LED`
                        : BOARD_CONFIG.userButton === pin
                          ? 'User button'
                          : 'GPIO';
                      return (
                        <div
                          key={`${gpio.port}-${pin}`}
                          className="info-row pin-row"
                          title={`${pin} — ${gpio.mode}`}
                        >
                          <span className="info-label">
                            <code className="pin-code">{pin}</code>
                          </span>
                          <span className="info-value pin-purpose">
                            {label} · {gpio.mode.replace(/^GPIO_MODE_/, '')}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="info-row pin-row">
                      <span className="info-label no-pins-hint">
                        Generate or load a job to see its pins
                      </span>
                    </div>
                  )}
                  {hardwareState?.clock && hardwareState.clock.sysclk_mhz !== undefined
                    && hardwareState.clock.sysclk_mhz !== 'Unknown' && (
                    <>
                      <div className="divider" />
                      <div className="info-row">
                        <span className="info-label">SYSCLK</span>
                        <span className="info-value">{hardwareState.clock.sysclk_mhz} MHz</span>
                      </div>
                      {hardwareState.clock.hclk_mhz !== undefined && (
                        <div className="info-row">
                          <span className="info-label">HCLK</span>
                          <span className="info-value">{hardwareState.clock.hclk_mhz} MHz</span>
                        </div>
                      )}
                      {hardwareState.clock.pclk1_mhz !== undefined && (
                        <div className="info-row">
                          <span className="info-label">APB1</span>
                          <span className="info-value">{hardwareState.clock.pclk1_mhz} MHz</span>
                        </div>
                      )}
                      {hardwareState.clock.pclk2_mhz !== undefined && (
                        <div className="info-row">
                          <span className="info-label">APB2</span>
                          <span className="info-value">{hardwareState.clock.pclk2_mhz} MHz</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>

            {settings.notifications && operationState === 'success' && (
              <section className="panel notification-panel">
                <div className="notification-banner success">
                  <CheckCircle className="icon" aria-hidden="true" />
                  <div>
                    <strong>Operation Complete</strong>
                    <p>{operationMessage}</p>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => resetOperation()}
                    aria-label="Dismiss"
                  >
                    <X className="icon" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {settings.notifications && operationState === 'error' && operationError && (
              <section className="panel notification-panel">
                <div className="notification-banner error">
                  <XCircle className="icon" aria-hidden="true" />
                  <div>
                    <strong>Operation Failed</strong>
                    <p>{operationError}</p>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => setOperationError(null)}
                    aria-label="Dismiss"
                  >
                    <X className="icon" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>

      {/* Flash Confirmation — shown BEFORE the flash, per the backend's
          confirmed:true requirement */}
      <FlashConfirmationDialog
        isOpen={showFlashDialog}
        onClose={() => setShowFlashDialog(false)}
        onConfirm={confirmFlash}
        hardwareState={hardwareState}
        code={generatedCode}
        jobId={jobId ?? null}
        ports={ports}
        selectedPort={flashPort}
        onPortChange={setFlashPort}
        pending={isProcessing}
      />
    </div>
  );
}
