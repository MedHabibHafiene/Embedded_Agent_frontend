import { useCallback, useState } from 'react';
import {
  Clock, Code, Download, Copy, CheckCircle, XCircle,
  RefreshCw, FolderOpen, Loader2, AlertCircle, HelpCircle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { getJob } from '../api/jobs';
import type { JobDetail, JobSummary, JobStatus } from '../types/firmware';
import './FirmwareHistory.css';

interface FirmwareHistoryProps {
  jobs: JobSummary[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Loads a finished job's code/hardware state back into the editor. */
  onLoadJob: (detail: JobDetail) => void;
}

type StatusKind = 'success' | 'error' | 'pending';

function statusKind(status: JobStatus): StatusKind {
  if (status === 'flashed' || status === 'verified') return 'success';
  if (status === 'compile_failed' || status === 'failed') return 'error';
  return 'pending'; // generated, flashing
}

function formatRelative(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 0) return 'just now';
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function FirmwareHistory({
  jobs,
  loading,
  error,
  onRefresh,
  onLoadJob,
}: FirmwareHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, JobDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | StatusKind>('all');

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return statusKind(job.status) === filter;
  });

  const successCount = jobs.filter(j => statusKind(j.status) === 'success').length;
  const errorCount = jobs.filter(j => statusKind(j.status) === 'error').length;

  const ensureDetail = useCallback(
    async (jobId: string): Promise<JobDetail | null> => {
      if (details[jobId]) return details[jobId];
      setDetailLoading(jobId);
      setDetailError(null);
      try {
        const detail = await getJob(jobId);
        setDetails(prev => ({ ...prev, [jobId]: detail }));
        return detail;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load job';
        setDetailError(message);
        return null;
      } finally {
        setDetailLoading(null);
      }
    },
    [details]
  );

  const handleToggle = useCallback(
    async (jobId: string) => {
      if (expanded === jobId) {
        setExpanded(null);
        return;
      }
      setExpanded(jobId);
      await ensureDetail(jobId);
    },
    [expanded, ensureDetail]
  );

  const handleLoad = useCallback(
    async (jobId: string) => {
      const detail = await ensureDetail(jobId);
      if (detail) {
        onLoadJob(detail);
      }
    },
    [ensureDetail, onLoadJob]
  );

  return (
    <div className="firmware-history">
      <div className="history-header">
        <div className="header-left">
          <Clock className="icon" aria-hidden="true" />
          <span className="title">Firmware Jobs</span>
          <button
            className="icon-btn"
            onClick={onRefresh}
            aria-label="Refresh job list"
            title="Refresh"
          >
            {loading ? (
              <Loader2 className="icon spinner" aria-hidden="true" />
            ) : (
              <RefreshCw className="icon" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="header-right">
          <div className="filter-group">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as typeof filter)}
              className="input input-sm"
              aria-label="Filter jobs"
            >
              <option value="all">All ({jobs.length})</option>
              <option value="success">Success ({successCount})</option>
              <option value="error">Errors ({errorCount})</option>
            </select>
          </div>
          <div className="header-stats">
            <span className="badge badge-success">{successCount}</span>
            <span className="badge badge-error">{errorCount}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="history-error">
          <AlertCircle className="icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {jobs.length === 0 && !loading && !error && (
        <div className="history-empty">
          <Clock className="icon" aria-hidden="true" />
          <p>No jobs yet</p>
          <span className="hint">Jobs generated on the backend will appear here</span>
        </div>
      )}

      {loading && jobs.length === 0 && (
        <div className="history-empty">
          <Loader2 className="icon spinner" aria-hidden="true" />
          <p>Loading jobs…</p>
        </div>
      )}

      <div className="history-list" role="list" aria-label="Firmware jobs">
        {filteredJobs.map(job => (
          <JobItem
            key={job.id}
            job={job}
            detail={details[job.id] ?? null}
            detailLoading={detailLoading === job.id}
            detailError={expanded === job.id ? detailError : null}
            isExpanded={expanded === job.id}
            onToggle={() => handleToggle(job.id)}
            onLoad={() => handleLoad(job.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface JobItemProps {
  job: JobSummary;
  detail: JobDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onLoad: () => void;
}

function JobItem({
  job,
  detail,
  detailLoading,
  detailError,
  isExpanded,
  onToggle,
  onLoad,
}: JobItemProps) {
  const kind = statusKind(job.status);

  return (
    <div className={`history-item ${kind} ${isExpanded ? 'expanded' : ''}`} role="listitem">
      <div className="item-summary" onClick={onToggle}>
        <div className="item-status">
          {kind === 'success' ? (
            <CheckCircle className="icon success" aria-hidden="true" />
          ) : kind === 'error' ? (
            <XCircle className="icon error" aria-hidden="true" />
          ) : (
            <HelpCircle className="icon" aria-hidden="true" />
          )}
        </div>
        <div className="item-main">
          <div className="item-prompt">{job.command}</div>
          <div className="item-meta">
            <span className="item-time" title={new Date(job.created_at).toLocaleString()}>
              <Clock className="icon" aria-hidden="true" />
              {formatRelative(job.created_at)}
            </span>
            <span className={`item-status-badge badge ${kind === 'success' ? 'badge-success' : kind === 'error' ? 'badge-error' : 'badge-neutral'}`}>
              {job.status}
            </span>
          </div>
        </div>
        <div className="item-actions">
          <button
            className="icon-btn"
            onClick={e => { e.stopPropagation(); onLoad(); }}
            aria-label="Load this job in the editor"
            title="Load in editor"
          >
            <FolderOpen className="icon" aria-hidden="true" />
          </button>
          <button
            className="icon-btn expand-btn"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="icon" /> : <ChevronDown className="icon" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="item-detail">
          {detailLoading && (
            <div className="detail-section">
              <Loader2 className="icon spinner" aria-hidden="true" />
              <span>Loading job…</span>
            </div>
          )}
          {detailError && (
            <div className="detail-section">
              <AlertCircle className="icon" aria-hidden="true" />
              <span>{detailError}</span>
            </div>
          )}
          {job.error && (
            <div className="detail-section">
              <div className="detail-header">
                <span className="detail-title">Error</span>
              </div>
              <pre className="log-preview"><code>{job.error}</code></pre>
            </div>
          )}
          {detail && (
            <>
              <div className="detail-section">
                <div className="detail-header">
                  <span className="detail-title">main.c</span>
                  <div className="detail-actions">
                    <button
                      className="icon-btn"
                      onClick={() => navigator.clipboard.writeText(detail.code)}
                      aria-label="Copy source"
                      title="Copy to clipboard"
                    >
                      <Copy className="icon" />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        const blob = new Blob([detail.code], { type: 'text/x-c' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `main-${detail.id.slice(0, 8)}.c`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      aria-label="Download source"
                      title="Download .c file"
                    >
                      <Download className="icon" />
                    </button>
                  </div>
                </div>
                <pre className="code-preview"><code>{detail.code}</code></pre>
              </div>
              <div className="detail-section">
                <div className="detail-header">
                  <span className="detail-title">
                    <Code className="icon" aria-hidden="true" /> Logs
                  </span>
                </div>
                <pre className="log-preview">
                  <code>{detail.logs || 'No logs recorded for this job'}</code>
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
