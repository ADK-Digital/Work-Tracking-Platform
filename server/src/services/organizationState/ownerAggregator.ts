import type { CanonicalWorkItem } from './types';
export const countUniqueOwners = (items: CanonicalWorkItem[]): number => new Set(items.map((item) => item.ownerGoogleId || item.ownerEmail).filter(Boolean)).size;
