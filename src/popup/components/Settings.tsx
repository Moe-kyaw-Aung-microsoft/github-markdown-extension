import React, { useState, useEffect } from 'react';
import { DEFAULT_AI_PROVIDERS, type AIProvider } from './ExportActions';

interface SettingsProps {
  token: string | null;
  onTokenSave: (token: string) => void;
  onTokenRemove: () => void;
}

type TokenStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export function Settings({ token, onTokenSave, onTokenRemove }: SettingsProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>(token ? 'valid' : 'idle');
  const [aiProviders, setAiProviders] = useState<AIProvider[]>(DEFAULT_AI_PROVIDERS);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Validate existing token on load
  useEffect(() => {
    if (token) {
      validateToken(token).then(isValid => {
        setTokenStatus(isValid ? 'valid' : 'invalid');
      });
    }
  }, [token]);

  // Load AI provider settings from storage
  useEffect(() => {
    chrome.storage.sync.get(['aiProviders'], (result) => {
      if (result.aiProviders) {
        const savedProviders = result.aiProviders as AIProvider[];
        const merged = DEFAULT_AI_PROVIDERS.map(defaultProvider => {
          const saved = savedProviders.find(p => p.id === defaultProvider.id);
          return saved ? { ...defaultProvider, enabled: saved.enabled } : defaultProvider;
        });
        setAiProviders(merged);
      }
    });
  }, []);

  const validateToken = async (tokenToValidate: string): Promise<boolean> => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenToValidate}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setTokenStatus('validating');

    const isValid = await validateToken(tokenInput.trim());

    if (isValid) {
      onTokenSave(tokenInput.trim());
      setTokenInput('');
      setTokenStatus('valid');
      setToast({ type: 'success', text: 'Token saved and validated!' });
    } else {
      setTokenStatus('invalid');
      setToast({ type: 'error', text: 'Invalid token. Please check and try again.' });
    }
  };

  const handleTokenRemove = () => {
    onTokenRemove();
    setTokenStatus('idle');
    setToast({ type: 'success', text: 'Token removed.' });
  };

  const toggleProvider = (providerId: string) => {
    const updated = aiProviders.map(p =>
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    );
    setAiProviders(updated);

    // Save to storage (only save id and enabled status)
    const toSave = updated.map(({ id, enabled }) => ({ id, enabled }));
    chrome.storage.sync.set({ aiProviders: toSave });

    setToast({ type: 'success', text: 'AI providers updated!' });
  };

  const getStatusIcon = () => {
    switch (tokenStatus) {
      case 'validating':
        return (
          <svg className="status-icon validating" viewBox="0 0 16 16" width="16" height="16">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="25" strokeLinecap="round" />
          </svg>
        );
      case 'valid':
        return (
          <svg className="status-icon valid" viewBox="0 0 16 16" width="16" height="16">
            <path fill="currentColor" d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z" />
          </svg>
        );
      case 'invalid':
        return (
          <svg className="status-icon invalid" viewBox="0 0 16 16" width="16" height="16">
            <path fill="currentColor" d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="settings">
      <section className={`settings-section token-section ${tokenStatus}`}>
        <div className="section-header">
          <h3>GitHub Token</h3>
          {getStatusIcon()}
        </div>
        <p className="hint">
          A personal access token allows access to private repositories and increases API rate limits.
        </p>

        {token ? (
          <div className="token-display">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              readOnly
              className="token-input"
            />
            <div className="token-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleTokenRemove}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleTokenSubmit} className="token-form">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="token-input"
              disabled={tokenStatus === 'validating'}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={tokenStatus === 'validating' || !tokenInput.trim()}
            >
              {tokenStatus === 'validating' ? 'Validating...' : 'Save'}
            </button>
          </form>
        )}

        <a
          href="https://github.com/settings/tokens/new?scopes=repo&description=GitHub%20Markdown%20Exporter"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          Create a new token →
        </a>
      </section>

      <section className="settings-section">
        <h3>AI Providers</h3>
        <p className="hint">
          Choose which AI chat providers to show in the export options.
        </p>

        <div className="ai-provider-list">
          {aiProviders.map(provider => (
            <label key={provider.id} className="checkbox-label ai-provider-item">
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={() => toggleProvider(provider.id)}
              />
              <span className="checkbox-control"></span>
              <span className="ai-provider-icon">{provider.icon}</span>
              <span className="ai-provider-name">{provider.name}</span>
              <span className="ai-provider-domain">({provider.domain})</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section about-section">
        <h3>About</h3>
        <p className="hint">
          GitHub Markdown Exporter v2.0.0
        </p>
        <a
          href="https://github.com/Fefedu973/github-markdown-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="link about-link"
        >
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path
              fill="currentColor"
              d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
            />
          </svg>
          View on GitHub →
        </a>
      </section>

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
