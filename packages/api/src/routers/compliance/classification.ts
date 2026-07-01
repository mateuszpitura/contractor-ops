/**
 * Classification router — merges draft, submit, and read sub-routers.
 */

import { mergeRouters } from '../../init';
import { classificationDraftRouter } from './classification-draft';
import { classificationOverrideRouter } from './classification-override';
import { classificationReadRouter } from './classification-read';
import { classificationSubmitRouter } from './classification-submit';

export const classificationRouter = mergeRouters(
  classificationDraftRouter,
  classificationSubmitRouter,
  classificationReadRouter,
  classificationOverrideRouter,
);
