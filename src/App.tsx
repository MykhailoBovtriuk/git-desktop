import './i18n/config';
import { useAutoRefresh } from './hooks/use-auto-refresh';
import { Shell } from './components/layout/Shell';

export default function App() {
  useAutoRefresh();
  return <Shell />;
}
