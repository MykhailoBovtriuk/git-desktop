import { Badge } from '../../shared/ui';
import { isMac } from '../../lib/keyboard';

/**
 * The app name at the left of a titlebar, clear of the macOS traffic lights.
 * Shared so every titlebar keeps the same offset.
 */
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

/** Room for the Windows/Linux title bar overlay buttons at the right edge. */
export function WindowControlsSpacer() {
  // The OS draws the window buttons on the left on macOS, on the right elsewhere.
  return isMac() ? null : <div className="w-36 shrink-0" />;
}
