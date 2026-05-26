import { useState } from 'react';

interface CredentialModalProps {
  remoteUrl: string;
  onCancel: () => void;
  onSubmit: (username: string, password: string) => void;
}

export function CredentialModal({ remoteUrl, onCancel, onSubmit }: CredentialModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) onSubmit(username, password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface0 rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-text text-lg font-semibold mb-1">Authentication Required</h2>
        <p className="text-subtext text-xs mb-4 truncate">{remoteUrl}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            className="bg-mantle text-text text-sm rounded px-3 py-2 outline-none border border-surface1 focus:border-blue placeholder:text-subtext"
          />
          <input
            type="password"
            placeholder="Password / Token"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-mantle text-text text-sm rounded px-3 py-2 outline-none border border-surface1 focus:border-blue placeholder:text-subtext"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-subtext hover:text-text transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!username || !password}
              className="px-3 py-1.5 text-sm bg-blue text-mantle rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Authenticate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
