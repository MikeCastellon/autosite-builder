// The reference screenshots the team adds to a custom-site project
// (project.assets entries of kind 'reference' marked addedBy: 'admin'):
// uploaded in the Design step (custom-site-admin reference-upload-url /
// reference-add) or taken by our browser from an address
// (custom-site-capture-background). Both count against one limit.
import { ASSET_KINDS, isTeamAsset } from '../../../src/lib/customSiteForm.js';

// The team's screenshots have their own room, as the customer's uploads
// have theirs (custom-site-form counts only the customer's own,
// customerAssets): a customer who filled their inspiration slots must not
// keep the team from adding the screenshot a match needs, and the other
// way round.
export const REFERENCE_TEAM_MAX = ASSET_KINDS.reference.max;
export const referenceCount = (assets) => (Array.isArray(assets) ? assets : []).filter((a) => a?.kind === 'reference' && isTeamAsset(a)).length;
export const REFERENCE_FULL = `The team already added ${REFERENCE_TEAM_MAX} reference screenshots to this project, the most it can hold.`;

// The entry `assets` already holds for `asset`, or null: the same path,
// or, for a tile of a cut-up screenshot, the same part of its group (a
// retried tile is a new upload with a new path: the first one stays, so a
// group never holds two of one part).
export function recordedReference(assets, asset) {
  const list = Array.isArray(assets) ? assets : [];
  return list.find((a) => a?.path === asset.path)
    || (asset.group ? list.find((a) => a?.kind === 'reference' && a.group === asset.group && a.part === asset.part) : null)
    || null;
}
