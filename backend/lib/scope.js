// Multi-tenant scoping helpers.
//
// The app owner (superadmin) sees and writes across all organizations. Everyone
// else is confined to their own organization_id.

// Org id to stamp on rows the actor creates (null for the owner).
function actorOrgId(req) {
  return req.user && req.user.role === 'superadmin' ? null : req.user.organization_id;
}

// Returns a SQL condition string scoping a query to the actor's organization,
// pushing the needed parameter onto `params`. Returns null for the owner (no
// restriction). `col` lets callers qualify the column (e.g. 'ct.organization_id').
function orgCond(req, params, col = 'organization_id') {
  if (req.user && req.user.role === 'superadmin') return null;
  params.push(req.user.organization_id);
  return `${col} = $${params.length}`;
}

module.exports = { actorOrgId, orgCond };
