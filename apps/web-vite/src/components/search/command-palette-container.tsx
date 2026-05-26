import {
  CommandPaletteIdleBody,
  CommandPaletteLoadingBody,
  CommandPaletteSearchingBody,
  CommandPaletteView,
} from './command-palette.js';
import { useCommandPalette } from './hooks/use-command-palette.js';

// Decision: container picks the palette body variant — loading skeleton while
// the navigation set is hydrating, the searching body when the user has typed,
// otherwise the idle body with recents/pinned/quick actions — and forwards the
// chosen body plus the open-state controls to the presentational shell.
export function CommandPaletteContainer() {
  const vm = useCommandPalette();

  const body = vm.isLoading ? (
    <CommandPaletteLoadingBody />
  ) : vm.isSearching ? (
    <CommandPaletteSearchingBody
      searchResults={vm.searchResults}
      docResults={vm.docResults}
      isDocLoading={vm.isDocLoading}
      matchedPages={vm.matchedPages}
      matchedActions={vm.matchedActions}
      onEntityClick={vm.onEntityClick}
      onPageNavigate={vm.onPageNavigate}
      onNavigate={vm.onNavigate}
      togglePin={vm.togglePin}
      isPinned={vm.isPinned}
    />
  ) : (
    <CommandPaletteIdleBody
      recentItems={vm.recentItems}
      pinnedItems={vm.pinnedItems}
      visibleNavItems={vm.visibleNavItems}
      quickActions={vm.quickActions}
      onRecentSelect={vm.onRecentSelect}
      onPageNavigate={vm.onPageNavigate}
      onNavigate={vm.onNavigate}
    />
  );

  return (
    <CommandPaletteView
      open={vm.open}
      setOpen={vm.setOpen}
      query={vm.query}
      onQueryChange={vm.onQueryChange}
      isSearching={vm.isSearching}
      searchResultsCount={vm.searchResults.length}
      showAriaLive={vm.isSearching && !vm.isLoading}
      body={body}
    />
  );
}
