import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2, X, Sparkles, Zap } from 'lucide-react';
import type { OperationState } from '../types/firmware';
import { EXAMPLE_COMMANDS } from '../types/firmware';
import './CommandEditor.css';

interface CommandEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (command: string) => void;
  disabled: boolean;
  operationState: OperationState;
  autoConfirm: boolean;
  onAutoConfirmChange: (value: boolean) => void;
  /** Flash the currently loaded job; undefined hides the Flash button. */
  onFlash?: () => void;
  canFlash?: boolean;
}

export function CommandEditor({
  value,
  onChange,
  onSubmit,
  disabled,
  operationState,
  autoConfirm,
  onAutoConfirmChange,
  onFlash,
  canFlash = false,
}: CommandEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [rows, setRows] = useState(3);

  useEffect(() => {
    if (textareaRef.current) {
      const lineCount = value.split('\n').length;
      setRows(Math.max(3, Math.min(lineCount + 1, 8)));
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit(value.trim());
      }
    }
  };

  const handleExampleClick = (cmd: string) => {
    onChange(cmd);
    setShowExamples(false);
    textareaRef.current?.focus();
  };

  const isGenerating = ['connecting', 'retrieving_context', 'generating', 'validating', 'compiling', 'flashing'].includes(operationState);

  return (
    <div className="command-editor">
      <div className="editor-header">
        <label className="label" htmlFor="command-input">
          Natural Language Command
        </label>
        <div className="header-actions">
          <button
            type="button"
            className={`icon-btn examples-toggle ${showExamples ? 'active' : ''}`}
            onClick={() => setShowExamples(!showExamples)}
            aria-expanded={showExamples}
            aria-controls="examples-panel"
            title="Example commands"
            disabled={disabled}
          >
            <Sparkles className="icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="editor-main">
        <textarea
          ref={textareaRef}
          id="command-input"
          className="input textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the firmware behavior you want... (Ctrl+Enter to submit)"
          disabled={disabled}
          rows={rows}
          aria-describedby="command-hint"
        />
        <div id="command-hint" className="editor-hint">
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit · Examples: {EXAMPLE_COMMANDS.length} available
        </div>

        {showExamples && (
          <div id="examples-panel" className="examples-panel" role="region" aria-label="Example commands">
            <div className="examples-header">
              <span className="examples-title">Example Commands</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowExamples(false)}
                aria-label="Close examples"
              >
                <X className="icon" aria-hidden="true" />
              </button>
            </div>
            <ul className="examples-list">
              {EXAMPLE_COMMANDS.map((cmd, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="example-item"
                    onClick={() => handleExampleClick(cmd)}
                    disabled={disabled}
                  >
                    <span className="example-text">{cmd}</span>
                    <Send className="example-icon" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="editor-footer">
        <label
          className="checkbox-label"
          title="Skip the confirmation dialog and flash right after a successful build"
        >
          <input
            type="checkbox"
            className="checkbox"
            checked={autoConfirm}
            onChange={(e) => onAutoConfirmChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="checkbox-text">Auto-confirm flash</span>
        </label>

        <div className="footer-actions">
          {onFlash && (
            <button
              type="button"
              className="btn btn-danger btn-sm flash-btn"
              onClick={onFlash}
              disabled={disabled || !canFlash}
              title={
                canFlash
                  ? 'Upload the current firmware to the board via ST-LINK'
                  : 'Generate firmware, or load a previous job from the Jobs tab, before flashing'
              }
            >
              <Zap className="icon" aria-hidden="true" />
              <span>Flash</span>
            </button>
          )}

          <button
            type="button"
            className={`btn btn-primary btn-sm submit-btn ${isGenerating ? 'loading' : ''}`}
            onClick={() => value.trim() && onSubmit(value.trim())}
            disabled={disabled || !value.trim() || isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="spinner" aria-hidden="true" />
                <span title="This can take several minutes">Processing…</span>
              </>
            ) : (
              <>
                <Send className="icon" aria-hidden="true" />
                <span>{autoConfirm ? 'Generate & Flash' : 'Generate'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}