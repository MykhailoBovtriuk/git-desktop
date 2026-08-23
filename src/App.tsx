import './i18n/config';
import { useAutoRefresh } from './hooks/use-auto-refresh';
import { useTheme } from './hooks/use-theme';
import { Shell } from './components/layout/Shell';

export default function App() {
  useTheme();
  useAutoRefresh();
  return <Shell />;
}
