import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import type { SettingsCategory } from '../../stores/ui-store';
import {
  DiffIcon,
  DownloadIcon,
  GeneralIcon,
  GitBranchIcon,
  LogsIcon,
  TerminalIcon,
  UserIcon,
} from '../../shared/ui';
import { GeneralSection } from './GeneralSection';
import { AccountsSection } from './AccountsSection';
import { GitIdentitySection } from './GitIdentitySection';
import { DiffSection } from './DiffSection';
import { TerminalSection } from './TerminalSection';
import { LogsSection } from './LogsSection';
import { UpdateSection } from './UpdateSection';

interface CategoryDef {
  id: SettingsCategory;
  icon: IconType;
  Component: ComponentType;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'general', icon: GeneralIcon, Component: GeneralSection },
  { id: 'accounts', icon: UserIcon, Component: AccountsSection },
  { id: 'git', icon: GitBranchIcon, Component: GitIdentitySection },
  { id: 'diff', icon: DiffIcon, Component: DiffSection },
  { id: 'terminal', icon: TerminalIcon, Component: TerminalSection },
  { id: 'logs', icon: LogsIcon, Component: LogsSection },
  { id: 'updates', icon: DownloadIcon, Component: UpdateSection },
];
