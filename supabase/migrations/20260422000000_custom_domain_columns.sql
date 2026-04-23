-- Custom domain tracking columns
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS custom_hostname_apex_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_hostname_www_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at TIMESTAMPTZ;

-- Fast lookup by custom_domain (partial, only where populated)
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain
  ON sites(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Allowed status values (not a hard enum for flexibility, but documented)
COMMENT ON COLUMN sites.custom_domain_status IS
  'Status enum: pending_dns | active_dns | active_ssl | error_dns | error_ssl | disconnected';
