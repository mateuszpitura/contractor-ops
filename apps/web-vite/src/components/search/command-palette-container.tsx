import { CommandPaletteView } from './command-palette.js';
import { useCommandPalette } from './hooks/use-command-palette.js';

export function CommandPaletteContainer() {
  const vm = useCommandPalette();
  return <CommandPaletteView {...vm} />;
}
