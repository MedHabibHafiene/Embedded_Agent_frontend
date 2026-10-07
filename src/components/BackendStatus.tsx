import { useEffect, useState, useCallback } from 'react';
import { Server } from 'lucide-react';
import { checkHealthSafe } from '../api/health';
import './BackendStatus.css';

interface BackendStatusProps {
  onStatusChange?: (healthy: boolean) => void;
  pollingInterval?: number;
}

export function BackendStatus({
  onStatusChange,
  pollingInterval = 10000,
}: BackendStatusProps) {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    const result = await checkHealthSafe();
    setHealthy(result.healthy);
    setLastCheck(new Date());
    if (result.error) {
      setError(result.error);
    }
    onStatusChange?.(result.healthy);
    setChecking(false);
  }, [onStatusChange]);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollingInterval);
    return () => clearInterval(interval);
  }, [check, pollingInterval]);

  const statusClass = healthy === null ? 'unknown' : healthy ? 'healthy' : 'unhealthy';
  const statusText = healthy === null ? 'Checking' : healthy ? 'Online' : 'Offline';

  // Details live in the hover tooltip; the icon itself stays minimal.
  const tooltip = [
    `Backend API: ${statusText}`,
    lastCheck ? `Last checked: ${lastCheck.toLocaleTimeString()}` : null,
    error ? `Error: ${error}` : null,
    'Click to retry',
  ].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      className={`backend-status ${statusClass} ${checking ? 'checking' : ''}`}
      onClick={check}
      title={tooltip}
      aria-label={`Backend ${statusText}`}
      aria-live="polite"
    >
      <Server className="status-icon" aria-hidden="true" />
    </button>
  );
}
