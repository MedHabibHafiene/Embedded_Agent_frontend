import { useMemo } from 'react';
import {
  Loader2, CheckCircle, XCircle, AlertCircle,
  Wifi, Zap, Cpu, Terminal, Upload
} from 'lucide-react';
import type { OperationState } from '../types/firmware';
import { OPERATION_STATE_LABELS as LABELS, OPERATION_STATE_COLORS as COLORS } from '../types/firmware';
import './OperationProgress.css';

interface OperationProgressProps {
  state: OperationState;
  message: string;
  progress?: number;
  logs?: string[];
  error?: string | null;
  jobId?: string | undefined;
  onRetry?: () => void;
  onDismissError?: () => void;
  /** Action buttons (Verify / Flash…) rendered with the success banner. */
  actions?: React.ReactNode;
}

const STATE_ICONS: Record<OperationState, React.ComponentType<{ className?: string }>> = {
  idle: Cpu,
  connecting: Wifi,
  retrieving_context: Wifi,
  generating: Zap,
  validating: Cpu,
  compiling: Terminal,
  flashing: Upload,
  success: CheckCircle,
  error: XCircle,
};

const STATE_ORDER: OperationState[] = [
  'idle',
  'connecting',
  'retrieving_context',
  'generating',
  'validating',
  'compiling',
  'flashing',
  'success',
];

export function OperationProgress({
  state,
  message,
  progress,
  logs,
  error,
  jobId,
  onRetry,
  onDismissError,
  actions,
}: OperationProgressProps) {
  const currentIndex = useMemo(() => STATE_ORDER.indexOf(state), [state]);
  const completedStates = useMemo(
    () => STATE_ORDER.slice(0, currentIndex + 1).filter(s => s !== 'idle'),
    [currentIndex]
  );
  const pendingStates = useMemo(
    () => STATE_ORDER.slice(currentIndex + 1).filter(s => s !== 'idle'),
    [currentIndex]
  );
  const isActive = ['connecting', 'retrieving_context', 'generating', 'validating', 'compiling', 'flashing'].includes(state);
  const isError = state === 'error';
  const isSuccess = state === 'success';

  return (
    <div className={`operation-progress ${state}`}>
      <div className="progress-header">
        <div className="current-state">
          <div className="state-indicator">
            {isActive && <Loader2 className="spinner" aria-hidden="true" />}
            {!isActive && !isError && !isSuccess && (
              <CheckCircle className="icon completed" aria-hidden="true" />
            )}
            {isSuccess && <CheckCircle className="icon success" aria-hidden="true" />}
            {isError && <XCircle className="icon error" aria-hidden="true" />}
            {!isActive && !isError && !isSuccess && currentIndex === -1 && (
              <Cpu className="icon idle" aria-hidden="true" />
            )}
          </div>
          <div className="state-info">
            <span className="state-label">{LABELS[state]}</span>
            {message && <span className="state-message">{message}</span>}
          </div>
        </div>
        {jobId && (
          <span className="job-id" title={jobId}>Job: {jobId.slice(0, 8)}...</span>
        )}
      </div>

      <div className="progress-steps" role="list" aria-label="Operation steps">
        {STATE_ORDER.filter(s => s !== 'idle').map((stepState, index) => {
          const isCompleted = completedStates.includes(stepState);
          const isCurrent = stepState === state && isActive;
          const isPending = pendingStates.includes(stepState);
          const Icon = STATE_ICONS[stepState];

          return (
            <div
              key={stepState}
              className={`step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
              role="listitem"
            >
              <div className="step-marker">
                {isCompleted && <CheckCircle className="icon" aria-hidden="true" />}
                {isCurrent && <Loader2 className="spinner" aria-hidden="true" />}
                {!isCompleted && !isCurrent && <Icon className="icon" aria-hidden="true" />}
              </div>
              <div className="step-label" title={LABELS[stepState]}>
                {LABELS[stepState]}
              </div>
              {index < STATE_ORDER.length - 2 && <div className="step-connector" />}
            </div>
          );
        })}
      </div>

      {(progress !== undefined && progress > 0 && progress < 100 && isActive) && (
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="progress-fill"
            style={{ width: `${progress}%`, backgroundColor: COLORS[state] }}
          />
        </div>
      )}

      {isError && error && (
        <div className="error-banner" role="alert">
          <AlertCircle className="icon" aria-hidden="true" />
          <div className="error-content">
            <span className="error-title">Operation Failed</span>
            <pre className="error-message">{error}</pre>
          </div>
          <div className="error-actions">
            {onDismissError && (
              <button className="btn btn-ghost btn-sm" onClick={onDismissError}>
                Dismiss
              </button>
            )}
            {onRetry && (
              <button className="btn btn-primary btn-sm" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="success-banner">
          <CheckCircle className="icon" aria-hidden="true" />
          <span>{message || 'Operation completed'}</span>
          {actions}
          {jobId && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(jobId)}>
              Copy Job ID
            </button>
          )}
        </div>
      )}

      {logs && logs.length > 0 && (
        <details className="logs-summary" open={isActive || isError}>
          <summary className="logs-toggle">
            <Terminal className="icon" aria-hidden="true" />
            <span>Build & Flash Logs ({logs.length})</span>
            <AlertCircle className="icon" aria-hidden="true" />
          </summary>
          <div className="logs-preview">
            {logs.slice(-10).map((log, i) => (
              <div key={i} className={`log-entry ${classifyLog(log)}`}>
                {log}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function classifyLog(log: string): string {
  const lower = log.toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal')) return 'log-entry-error';
  if (lower.includes('warning') || lower.includes('warn')) return 'log-entry-warning';
  if (lower.includes('success') || lower.includes('ok') || lower.includes('done')) return 'log-entry-success';
  if (lower.includes('info') || lower.includes('debug')) return 'log-entry-debug';
  return 'log-entry-info';
}