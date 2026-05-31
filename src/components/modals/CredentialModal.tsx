import { useState } from 'react';
import { Button, Modal, TextInput } from '../../shared/ui';

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
    <Modal
      title="Authentication Required"
      subtitle={<span className="truncate block">{remoteUrl}</span>}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!username || !password}
            form="credential-form"
          >
            Authenticate
          </Button>
        </>
      }
    >
      <form id="credential-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextInput variant="modal" type="text" placeholder="Username" autoFocus
          value={username} onChange={e => setUsername(e.target.value)} />
        <TextInput variant="modal" type="password" placeholder="Password / Token"
          value={password} onChange={e => setPassword(e.target.value)} />
      </form>
    </Modal>
  );
}
