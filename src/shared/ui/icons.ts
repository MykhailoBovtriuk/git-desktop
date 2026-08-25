// The one place the app names its icons. Call sites import from here, never
// from react-icons directly, so the underlying set can be swapped without
// touching a dozen components.
//
// `Fi` is Feather: a single outline set at one stroke weight, which is what
// keeps every icon in the UI looking like it came from the same family. The
// glyph literals these replaced (↻ ⚙ ⓘ + − × 📋 ↩ ✕) could not: each came
// from whatever system font the OS picked, at its own size and weight, and the
// emoji ones ignored colour entirely.
export {
  FiRefreshCw as RefreshIcon,
  FiSettings as SettingsIcon,
  FiInfo as InfoIcon,
  FiPlus as StageIcon,
  FiMinus as UnstageIcon,
  FiX as DiscardIcon,
  FiX as CloseIcon,
  FiUser as UserIcon,
  FiCopy as StashApplyIcon,
  FiCornerUpLeft as StashPopIcon,
  FiTrash2 as StashDropIcon,
} from 'react-icons/fi';
