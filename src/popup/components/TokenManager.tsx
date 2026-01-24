import React, { useState } from 'react';

interface TokenManagerProps {
  token: string | null;
  onSave: (token: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function TokenManager({ token, onSave, onRemove }: TokenManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSave = async () => {
    if (!inputValue.trim()) {
      setValidationStatus('error');
      setErrorMessage('Please enter a token');
      return;
    }

    setIsValidating(true);
    setValidationStatus('idle');
    setErrorMessage('');

    try {
      // Validate token with GitHub API
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${inputValue.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        await onSave(inputValue.trim());
        setInputValue('');
        setValidationStatus('success');
      } else {
        setValidationStatus('error');
        setErrorMessage('Invalid token - authentication failed');
      }
    } catch (error) {
      setValidationStatus('error');
      setErrorMessage('Failed to validate token');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = async () => {
    await onRemove();
    setValidationStatus('idle');
  };

  return (
    <div className="token-manager">
      <h2>GitHub Personal Access Token</h2>

      <p className="description">
        A GitHub token is required to access private repositories and avoid rate limits.
        Create a token with <code>repo</code> scope at{' '}
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Settings
        </a>
      </p>

      {token ? (
        <div className="token-status">
          <div className="status-badge success">
            <svg viewBox="0 0 16 16" width="16" height="16">
              <path
                fill="currentColor"
                d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-1.042-.018l-3.992 3.992-1.48-1.48a.751.751 0 0 0-1.042 1.042l2 2a.75.75 0 0 0 1.06 0l4.5-4.5a.751.751 0 0 0-.014-1.042Z"
              />
            </svg>
            Token configured
          </div>
          <button className="btn btn-danger" onClick={handleRemove}>
            Remove Token
          </button>
        </div>
      ) : (
        <div className="token-input">
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            disabled={isValidating}
          />
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isValidating || !inputValue.trim()}
          >
            {isValidating ? 'Validating...' : 'Save Token'}
          </button>
        </div>
      )}

      {validationStatus === 'success' && (
        <div className="message success">Token saved successfully!</div>
      )}

      {validationStatus === 'error' && (
        <div className="message error">{errorMessage}</div>
      )}

      <div className="permissions-info">
        <h3>Required Permissions</h3>
        <ul>
          <li><code>repo</code> - Access private repositories</li>
          <li><code>read:user</code> - Read user profile (optional)</li>
        </ul>
      </div>
    </div>
  );
}
