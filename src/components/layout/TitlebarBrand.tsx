import { Badge } from '../../shared/ui';
import { isMac } from '../../lib/keyboard';

export function TitlebarBrand() {
  return (
    <>
      <div className={isMac() ? 'w-20 shrink-0' : 'w-3 shrink-0'} />
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-text font-semibold text-sm">Git Desktop</span>
        <Badge variant="beta">Beta</Badge>
      </div>
    </>
  );
}

export function WindowControlsSpacer() {
  return isMac() ? null : <div className="w-36 shrink-0" />;
}
