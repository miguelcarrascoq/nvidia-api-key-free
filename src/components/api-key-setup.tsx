'use client';

import { useEffect, useState } from 'react';

import { useApiKeyStore } from '@/store/api-key';

type ApiKeySetupProps = {
  open: boolean;
  onClose?: () => void;
  allowDismiss?: boolean;
};

export function ApiKeySetup({
  open,
  onClose,
  allowDismiss = false,
}: ApiKeySetupProps) {
  const apiKey = useApiKeyStore((state) => state.apiKey);
  const setApiKey = useApiKeyStore((state) => state.setApiKey);
  const clearApiKey = useApiKeyStore((state) => state.clearApiKey);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(apiKey);
    }
  }, [open, apiKey]);

  if (!open) return null;

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;
    setApiKey(next);
    onClose?.();
  }

  function handleClear() {
    clearApiKey();
    setDraft('');
  }

  return (
    <div
      className="api-key-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-title"
    >
      <div className="api-key-modal panel">
        <div className="panel-head">
          <div>
            <h2 id="api-key-title">Your NVIDIA API key</h2>
            <p>
              This app does not ship with a shared key. Use your own — it is
              stored only in this browser.
            </p>
          </div>
          {allowDismiss && onClose ? (
            <button type="button" className="btn secondary" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>

        <ol className="api-key-steps">
          <li>
            Go to{' '}
            <a
              href="https://build.nvidia.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              build.nvidia.com
            </a>
          </li>
          <li>Sign in or create an NVIDIA account</li>
          <li>
            Open a model or your profile and click <strong>Get API Key</strong> /{' '}
            <strong>Generate Key</strong>
          </li>
          <li>
            Copy the key (starts with <code>nvapi-</code>) and paste it below
          </li>
        </ol>

        <form className="api-key-form" onSubmit={handleSave}>
          <label>
            <span>API key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="nvapi-…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <div className="actions">
            <button
              type="submit"
              className="btn primary"
              disabled={!draft.trim()}
            >
              Save in this browser
            </button>
            {apiKey ? (
              <button
                type="button"
                className="btn secondary"
                onClick={handleClear}
              >
                Clear key
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
