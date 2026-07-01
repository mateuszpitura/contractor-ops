import { mergeRouters } from '../../../init';
import { classifyRouter } from './classify';
import { erasureRouter } from './erasure';
import { readRouter } from './read';

// The gated personnel-file ("akta osobowe") surface: per-section read now, with
// the classify and erasure procedures merged in from their own files so a later
// plan can fill them without touching this index. Mounted flag-gated in root.ts.
export const personnelFileRouter = mergeRouters(readRouter, classifyRouter, erasureRouter);
