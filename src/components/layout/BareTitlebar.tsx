import { DragRegion } from '../../shared/ui';
import { TitlebarBrand, WindowControlsSpacer } from './TitlebarBrand';

/**
 * The titlebar strip for screens shown without a repository (Settings, About):
 * keeps their header clear of the window buttons and the window draggable.
 */
export function BareTitlebar() {
  return (
    <DragRegion className="h-10 bg-mantle border-b border-surface0 flex items-center gap-4 shrink-0 select-none">
      <TitlebarBrand />
      <div className="flex-1" />
      <WindowControlsSpacer />
    </DragRegion>
  );
}
