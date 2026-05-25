import type { ClassificationTileEngagement } from './classification-tile.js';
import {
  ClassificationTileEmpty,
  ClassificationTileSkeleton,
  ClassificationTileView,
} from './classification-tile.js';
import { useClassificationTile } from './hooks/use-classification-tile.js';

export interface ClassificationTileContainerProps {
  readonly engagement: ClassificationTileEngagement;
}

export function ClassificationTileContainer(props: ClassificationTileContainerProps) {
  const { latest, isPending } = useClassificationTile(props.engagement.id);

  if (isPending) return <ClassificationTileSkeleton />;
  if (!latest?.outcome) return <ClassificationTileEmpty engagement={props.engagement} />;

  return <ClassificationTileView engagement={props.engagement} latest={latest} />;
}
