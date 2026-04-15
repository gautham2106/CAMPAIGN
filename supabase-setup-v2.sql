-- ============================================================
-- CAMPAIGN MONITOR v2 — SUPABASE SETUP SCRIPT
-- Run this in Supabase SQL Editor (execute all at once)
-- ============================================================

-- 1. CONSTITUENCIES
CREATE TABLE IF NOT EXISTS constituencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'constituency_admin', 'monitor')),
  constituency_id UUID REFERENCES constituencies(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If upgrading an existing database, run this migration:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. DIGITAL AGENTS
CREATE TABLE IF NOT EXISTS digital_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT,
  booth_number INTEGER,
  area TEXT,
  phone TEXT,
  fb_url TEXT,
  ig_url TEXT,
  twitter_url TEXT,
  constituency_id UUID REFERENCES constituencies(id),
  assigned_monitor_id UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Audit columns (migration: run ALTER TABLE block below if table already exists)
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ,
  reassigned_from UUID REFERENCES profiles(id),
  reassigned_at TIMESTAMPTZ
);

-- ============================================================
-- MIGRATION: Run this if digital_agents table already exists
-- ============================================================
-- ALTER TABLE digital_agents
--   ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
--   ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id),
--   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
--   ADD COLUMN IF NOT EXISTS reassigned_from UUID REFERENCES profiles(id),
--   ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

-- 4. DAILY CONTENT
CREATE TABLE IF NOT EXISTS daily_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  media_link TEXT,
  content_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- NULL = visible to ALL constituencies; array of UUIDs = targeted constituencies only
  target_constituencies UUID[] DEFAULT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If upgrading an existing database, run this migration:
-- ALTER TABLE daily_content ADD COLUMN IF NOT EXISTS target_constituencies UUID[] DEFAULT NULL;

-- 5. COMPLIANCE LOGS
CREATE TABLE IF NOT EXISTS compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES digital_agents(id) ON DELETE CASCADE,
  content_id UUID REFERENCES daily_content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'facebook', 'instagram')),
  is_checked BOOLEAN DEFAULT FALSE,
  checked_by UUID REFERENCES profiles(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, content_id, platform)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE constituencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_constituency()
RETURNS UUID AS $$
  SELECT constituency_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── CONSTITUENCIES ──
DROP POLICY IF EXISTS "All authenticated can read constituencies" ON constituencies;
CREATE POLICY "All authenticated can read constituencies"
  ON constituencies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin can manage constituencies" ON constituencies;
CREATE POLICY "Super admin can manage constituencies"
  ON constituencies FOR ALL TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ── PROFILES ──
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admin reads all profiles" ON profiles;
CREATE POLICY "Super admin reads all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Constituency admin reads own constituency profiles" ON profiles;
CREATE POLICY "Constituency admin reads own constituency profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    get_my_role() = 'constituency_admin'
    AND constituency_id = get_my_constituency()
  );

DROP POLICY IF EXISTS "Super admin manages profiles" ON profiles;
CREATE POLICY "Super admin manages profiles"
  ON profiles FOR ALL TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Constituency admin creates monitors" ON profiles;
CREATE POLICY "Constituency admin creates monitors"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'constituency_admin'
    AND role = 'monitor'
    AND constituency_id = get_my_constituency()
  );

-- Service role bypass (for admin client creating monitors from UI)
-- Note: supabaseAdmin client uses service_role key which bypasses RLS automatically.

-- ── DIGITAL AGENTS ──
DROP POLICY IF EXISTS "Super admin full access agents" ON digital_agents;
CREATE POLICY "Super admin full access agents"
  ON digital_agents FOR ALL TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Constituency admin full access own constituency agents" ON digital_agents;
CREATE POLICY "Constituency admin full access own constituency agents"
  ON digital_agents FOR ALL TO authenticated
  USING (
    get_my_role() = 'constituency_admin'
    AND constituency_id = get_my_constituency()
  )
  WITH CHECK (
    get_my_role() = 'constituency_admin'
    AND constituency_id = get_my_constituency()
  );

DROP POLICY IF EXISTS "Monitor reads own assigned agents" ON digital_agents;
CREATE POLICY "Monitor reads own assigned agents"
  ON digital_agents FOR SELECT TO authenticated
  USING (
    get_my_role() = 'monitor'
    AND assigned_monitor_id = auth.uid()
  );

DROP POLICY IF EXISTS "Monitor inserts agents" ON digital_agents;
CREATE POLICY "Monitor inserts agents"
  ON digital_agents FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'monitor'
    AND assigned_monitor_id = auth.uid()
  );

DROP POLICY IF EXISTS "Monitor updates own assigned agents" ON digital_agents;
CREATE POLICY "Monitor updates own assigned agents"
  ON digital_agents FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'monitor'
    AND assigned_monitor_id = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'monitor'
  );
-- USING: monitor can only update agents currently assigned to them.
-- WITH CHECK: only role check — allows changing assigned_monitor_id for booth reassignment.
-- NOTE: No DELETE policy for monitors — they cannot delete agents.
-- Only constituency admins (FOR ALL policy above) and super admins can delete.

-- ── DAILY CONTENT ──
DROP POLICY IF EXISTS "All authenticated can read content" ON daily_content;
CREATE POLICY "All authenticated can read content"
  ON daily_content FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages content" ON daily_content;
CREATE POLICY "Super admin manages content"
  ON daily_content FOR ALL TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ── COMPLIANCE LOGS ──
DROP POLICY IF EXISTS "Super admin reads all logs" ON compliance_logs;
CREATE POLICY "Super admin reads all logs"
  ON compliance_logs FOR SELECT TO authenticated
  USING (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Constituency admin reads logs for own constituency" ON compliance_logs;
CREATE POLICY "Constituency admin reads logs for own constituency"
  ON compliance_logs FOR SELECT TO authenticated
  USING (
    get_my_role() = 'constituency_admin'
    AND agent_id IN (
      SELECT id FROM digital_agents WHERE constituency_id = get_my_constituency()
    )
  );

DROP POLICY IF EXISTS "Monitor reads own logs" ON compliance_logs;
CREATE POLICY "Monitor reads own logs"
  ON compliance_logs FOR SELECT TO authenticated
  USING (
    get_my_role() = 'monitor'
    AND checked_by = auth.uid()
  );

DROP POLICY IF EXISTS "Monitor inserts own logs" ON compliance_logs;
CREATE POLICY "Monitor inserts own logs"
  ON compliance_logs FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'monitor'
    AND checked_by = auth.uid()
    AND agent_id IN (
      SELECT id FROM digital_agents WHERE assigned_monitor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Monitor updates own logs" ON compliance_logs;
CREATE POLICY "Monitor updates own logs"
  ON compliance_logs FOR UPDATE TO authenticated
  USING (checked_by = auth.uid())
  WITH CHECK (checked_by = auth.uid());

-- ============================================================
-- SEED: Create your Super Admin profile
-- 1. Go to Supabase Dashboard → Authentication → Users → Add user
-- 2. Enter super admin email + password, confirm email
-- 3. Copy the user UUID from the list
-- 4. Uncomment and run the INSERT below with the real UUID
-- ============================================================

-- INSERT INTO profiles (id, full_name, email, role)
-- VALUES ('PASTE-AUTH-USER-UUID-HERE', 'Super Admin', 'admin@yourdomain.com', 'super_admin');

-- ============================================================
-- SEED: Create Constituency Admin profile
-- 1. Create the auth user same way as above
-- 2. First create the constituency:
--    INSERT INTO constituencies (name) VALUES ('Constituency Name');
-- 3. Then run:
-- ============================================================

-- INSERT INTO profiles (id, full_name, email, role, constituency_id)
-- VALUES (
--   'PASTE-CONSTITUENCY-ADMIN-UUID',
--   'Admin Name',
--   'admin@example.com',
--   'constituency_admin',
--   (SELECT id FROM constituencies WHERE name = 'Constituency Name')
-- );

-- ============================================================
-- MONITOR BOOTH ASSIGNMENTS
-- Maps monitors to their permanent booth number ranges.
-- Used for auto-assigning agents based on their booth number.
-- Migration (if table doesn't exist yet):
--   Run the CREATE TABLE below in Supabase SQL Editor.
-- ============================================================
CREATE TABLE IF NOT EXISTS monitor_booth_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  constituency_id UUID REFERENCES constituencies(id) ON DELETE CASCADE,
  booth_from INT NOT NULL,
  booth_to INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monitor_booth_assignments ENABLE ROW LEVEL SECURITY;

-- Constituency admins can manage assignments for their constituency
CREATE POLICY IF NOT EXISTS "Const admins manage booth assignments"
  ON monitor_booth_assignments FOR ALL
  USING (
    constituency_id IN (
      SELECT constituency_id FROM profiles WHERE id = auth.uid()
      AND role IN ('constituency_admin', 'super_admin')
    )
  );

-- Monitors can read all assignments in their constituency (needed to detect cross-monitor booth reassignment)
-- Migration: DROP POLICY IF EXISTS "Monitors read own booth assignments" ON monitor_booth_assignments; then re-run this
CREATE POLICY IF NOT EXISTS "Monitors read constituency booth assignments"
  ON monitor_booth_assignments FOR SELECT
  USING (
    constituency_id IN (
      SELECT constituency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Super admins full access
CREATE POLICY IF NOT EXISTS "Super admins full booth assignments"
  ON monitor_booth_assignments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_booth_assignments_monitor ON monitor_booth_assignments(monitor_id);
CREATE INDEX IF NOT EXISTS idx_booth_assignments_constituency ON monitor_booth_assignments(constituency_id);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_digital_agents_constituency ON digital_agents(constituency_id);
CREATE INDEX IF NOT EXISTS idx_digital_agents_monitor ON digital_agents(assigned_monitor_id);
CREATE INDEX IF NOT EXISTS idx_digital_agents_booth ON digital_agents(booth_number);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_agent ON compliance_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_content ON compliance_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_daily_content_date ON daily_content(content_date);
CREATE INDEX IF NOT EXISTS idx_profiles_constituency ON profiles(constituency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- MIGRATION: If you have already run this script previously:
-- DROP POLICY IF EXISTS "Monitors read own booth assignments" ON monitor_booth_assignments;
-- Then re-run the CREATE POLICY above ("Monitors read constituency booth assignments")
-- ============================================================

-- ============================================================
-- VIEW: agent_compliance
-- Aggregates compliance_logs into one row per (agent_id, content_id)
-- instead of 3 rows per platform. Reduces data fetched by 3x.
-- Used by the super admin dashboard and constituency admin overview.
-- ============================================================
CREATE OR REPLACE VIEW agent_compliance AS
WITH agg AS (
  SELECT
    agent_id,
    content_id,
    bool_or(platform = 'whatsapp' AND is_checked) AS wa,
    bool_or(platform = 'facebook' AND is_checked) AS fb,
    bool_or(platform = 'instagram' AND is_checked) AS ig
  FROM compliance_logs
  GROUP BY agent_id, content_id
)
SELECT
  agent_id,
  content_id,
  wa,
  fb,
  ig,
  (wa AND fb AND ig) AS all_done
FROM agg;

-- Grant read access to authenticated users (view inherits underlying table RLS)
GRANT SELECT ON agent_compliance TO authenticated;

-- ============================================================
-- VIEW: constituency_content_stats
-- Pre-aggregated per (content_id, constituency_id, content_date).
-- Super admin dashboard query: just filter by content_date → a few rows.
-- ============================================================
CREATE OR REPLACE VIEW constituency_content_stats AS
SELECT
  dc.id            AS content_id,
  dc.content_date,
  dc.title,
  dc.target_constituencies,
  da.constituency_id,
  COUNT(DISTINCT da.id)                                               AS total_agents,
  COUNT(DISTINCT CASE WHEN ac.wa        THEN da.id END)              AS wa_done,
  COUNT(DISTINCT CASE WHEN ac.fb        THEN da.id END)              AS fb_done,
  COUNT(DISTINCT CASE WHEN ac.ig        THEN da.id END)              AS ig_done,
  COUNT(DISTINCT CASE WHEN ac.all_done  THEN da.id END)              AS all_done
FROM daily_content dc
JOIN digital_agents da
  ON (dc.target_constituencies IS NULL
      OR da.constituency_id = ANY(dc.target_constituencies))
LEFT JOIN agent_compliance ac
  ON ac.agent_id = da.id AND ac.content_id = dc.id
GROUP BY
  dc.id, dc.content_date, dc.title, dc.target_constituencies,
  da.constituency_id;

GRANT SELECT ON constituency_content_stats TO authenticated;

-- ============================================================
-- TABLE: places
-- Booth-range to place name mapping per constituency.
-- One constituency can have many place entries (each with booth_from/booth_to).
-- A monitor may cover booths spanning multiple places.
-- ============================================================
CREATE TABLE IF NOT EXISTS places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constituency_id UUID REFERENCES constituencies(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  booth_from      INTEGER NOT NULL,
  booth_to        INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_places_constituency ON places(constituency_id);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access places" ON places;
CREATE POLICY "Super admin full access places"
  ON places FOR ALL TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Const admin reads own places" ON places;
CREATE POLICY "Const admin reads own places"
  ON places FOR SELECT TO authenticated
  USING (get_my_role() = 'constituency_admin' AND constituency_id = get_my_constituency());

DROP POLICY IF EXISTS "Monitor reads constituency places" ON places;
CREATE POLICY "Monitor reads constituency places"
  ON places FOR SELECT TO authenticated
  USING (
    get_my_role() = 'monitor'
    AND constituency_id = (SELECT constituency_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- VIEW: monitor_content_stats
-- Pre-aggregated per (content_id, monitor_id, constituency_id).
-- Used by super admin Admins tab for per-monitor compliance breakdown.
-- Only includes agents that have an assigned_monitor_id.
-- ============================================================
CREATE OR REPLACE VIEW monitor_content_stats AS
SELECT
  dc.id            AS content_id,
  dc.content_date,
  dc.title,
  dc.target_constituencies,
  da.assigned_monitor_id  AS monitor_id,
  da.constituency_id,
  COUNT(DISTINCT da.id)                                               AS total_agents,
  COUNT(DISTINCT CASE WHEN ac.wa        THEN da.id END)              AS wa_done,
  COUNT(DISTINCT CASE WHEN ac.fb        THEN da.id END)              AS fb_done,
  COUNT(DISTINCT CASE WHEN ac.ig        THEN da.id END)              AS ig_done,
  COUNT(DISTINCT CASE WHEN ac.all_done  THEN da.id END)              AS all_done
FROM daily_content dc
JOIN digital_agents da
  ON (dc.target_constituencies IS NULL
      OR da.constituency_id = ANY(dc.target_constituencies))
  AND da.assigned_monitor_id IS NOT NULL
LEFT JOIN agent_compliance ac
  ON ac.agent_id = da.id AND ac.content_id = dc.id
GROUP BY
  dc.id, dc.content_date, dc.title, dc.target_constituencies,
  da.assigned_monitor_id, da.constituency_id;

GRANT SELECT ON monitor_content_stats TO authenticated;

-- ============================================================
-- MIGRATION NOTE (run in Supabase SQL editor):
-- If views already exist, DROP them first:
--   DROP VIEW IF EXISTS monitor_content_stats;
--   DROP VIEW IF EXISTS constituency_content_stats;
--   DROP VIEW IF EXISTS agent_compliance;
-- Then re-run the CREATE OR REPLACE VIEW statements above.
-- ============================================================

-- ============================================================
-- QUICK RUN: Copy and paste this block into Supabase SQL Editor
-- to add the monitor_content_stats view without re-running everything:
-- ============================================================
-- DROP VIEW IF EXISTS monitor_content_stats;
-- CREATE OR REPLACE VIEW monitor_content_stats AS
-- SELECT
--   dc.id            AS content_id,
--   dc.content_date,
--   dc.title,
--   dc.target_constituencies,
--   da.assigned_monitor_id  AS monitor_id,
--   da.constituency_id,
--   COUNT(DISTINCT da.id)                                               AS total_agents,
--   COUNT(DISTINCT CASE WHEN ac.wa        THEN da.id END)              AS wa_done,
--   COUNT(DISTINCT CASE WHEN ac.fb        THEN da.id END)              AS fb_done,
--   COUNT(DISTINCT CASE WHEN ac.ig        THEN da.id END)              AS ig_done,
--   COUNT(DISTINCT CASE WHEN ac.all_done  THEN da.id END)              AS all_done
-- FROM daily_content dc
-- JOIN digital_agents da
--   ON (dc.target_constituencies IS NULL
--       OR da.constituency_id = ANY(dc.target_constituencies))
--   AND da.assigned_monitor_id IS NOT NULL
-- LEFT JOIN agent_compliance ac
--   ON ac.agent_id = da.id AND ac.content_id = dc.id
-- GROUP BY
--   dc.id, dc.content_date, dc.title, dc.target_constituencies,
--   da.assigned_monitor_id, da.constituency_id;
-- GRANT SELECT ON monitor_content_stats TO authenticated;
-- ============================================================

-- ============================================================
-- VIEW: place_content_stats
-- Pre-aggregated per (content_id, constituency_id, place_name).
-- Groups by place NAME so multiple booth ranges with identical names
-- are merged into one row.  Monitors covering any range in that
-- name-group are combined via string_agg(DISTINCT …).
-- ============================================================
CREATE OR REPLACE VIEW place_content_stats AS
WITH place_monitors AS (
  -- One row per (constituency_id, place_name), combining all monitors
  -- whose booth assignment range overlaps any range with that name.
  SELECT
    p.constituency_id,
    p.name AS place_name,
    string_agg(DISTINCT prof.full_name, ', ') AS monitor_names
  FROM places p
  JOIN monitor_booth_assignments mba
    ON  mba.constituency_id = p.constituency_id
    AND mba.booth_from <= p.booth_to
    AND mba.booth_to   >= p.booth_from
  JOIN profiles prof ON prof.id = mba.monitor_id
  GROUP BY p.constituency_id, p.name
)
SELECT
  dc.id               AS content_id,
  dc.content_date,
  dc.title,
  dc.target_constituencies,
  p.constituency_id,
  p.name              AS place_name,
  pm.monitor_names,
  COUNT(DISTINCT da.id)                                              AS total_agents,
  COUNT(DISTINCT CASE WHEN ac.wa       THEN da.id END)              AS wa_done,
  COUNT(DISTINCT CASE WHEN ac.fb       THEN da.id END)              AS fb_done,
  COUNT(DISTINCT CASE WHEN ac.ig       THEN da.id END)              AS ig_done,
  COUNT(DISTINCT CASE WHEN ac.all_done THEN da.id END)              AS all_done
FROM daily_content dc
JOIN digital_agents da
  ON (dc.target_constituencies IS NULL
      OR da.constituency_id = ANY(dc.target_constituencies))
JOIN places p
  ON  p.constituency_id = da.constituency_id
  AND da.booth_number BETWEEN p.booth_from AND p.booth_to
LEFT JOIN place_monitors pm
  ON  pm.constituency_id = p.constituency_id
  AND pm.place_name      = p.name
LEFT JOIN agent_compliance ac
  ON ac.agent_id = da.id AND ac.content_id = dc.id
GROUP BY
  dc.id, dc.content_date, dc.title, dc.target_constituencies,
  p.constituency_id, p.name, pm.monitor_names;

GRANT SELECT ON place_content_stats TO authenticated;

-- ============================================================
-- QUICK RUN: paste this block into Supabase SQL Editor to create/update
-- the place_content_stats view without touching any tables or data.
-- ============================================================
-- DROP VIEW IF EXISTS place_content_stats;
-- CREATE OR REPLACE VIEW place_content_stats AS
-- WITH place_monitors AS (
--   SELECT p.constituency_id, p.name AS place_name,
--     string_agg(DISTINCT prof.full_name, ', ') AS monitor_names
--   FROM places p
--   JOIN monitor_booth_assignments mba
--     ON mba.constituency_id = p.constituency_id
--     AND mba.booth_from <= p.booth_to AND mba.booth_to >= p.booth_from
--   JOIN profiles prof ON prof.id = mba.monitor_id
--   GROUP BY p.constituency_id, p.name
-- )
-- SELECT dc.id AS content_id, dc.content_date, dc.title,
--   dc.target_constituencies, p.constituency_id,
--   p.name AS place_name, pm.monitor_names,
--   COUNT(DISTINCT da.id) AS total_agents,
--   COUNT(DISTINCT CASE WHEN ac.wa THEN da.id END) AS wa_done,
--   COUNT(DISTINCT CASE WHEN ac.fb THEN da.id END) AS fb_done,
--   COUNT(DISTINCT CASE WHEN ac.ig THEN da.id END) AS ig_done,
--   COUNT(DISTINCT CASE WHEN ac.all_done THEN da.id END) AS all_done
-- FROM daily_content dc
-- JOIN digital_agents da
--   ON (dc.target_constituencies IS NULL OR da.constituency_id = ANY(dc.target_constituencies))
-- JOIN places p
--   ON p.constituency_id = da.constituency_id
--   AND da.booth_number BETWEEN p.booth_from AND p.booth_to
-- LEFT JOIN place_monitors pm
--   ON pm.constituency_id = p.constituency_id AND pm.place_name = p.name
-- LEFT JOIN agent_compliance ac ON ac.agent_id = da.id AND ac.content_id = dc.id
-- GROUP BY dc.id, dc.content_date, dc.title, dc.target_constituencies,
--   p.constituency_id, p.name, pm.monitor_names;
-- GRANT SELECT ON place_content_stats TO authenticated;
-- ============================================================

-- ============================================================
-- VIEW: monitor_field_ops_stats
-- Pre-aggregated per monitor for the Field Ops tab.
-- Computes vacant_booths and link_issues in the DB using generate_series
-- so the frontend doesn't have to loop through every booth number in JS.
--
-- vacant_booths = booths in the assigned range that have no agent assigned
-- link_issues   = agents missing or having invalid FB or IG URLs
-- ============================================================
CREATE OR REPLACE VIEW monitor_field_ops_stats AS
WITH booth_numbers AS (
  -- Expand every booth assignment row into one row per booth number
  SELECT
    mba.monitor_id,
    mba.constituency_id,
    generate_series(mba.booth_from, mba.booth_to) AS booth_num
  FROM monitor_booth_assignments mba
),
vacant AS (
  -- Booths that have no digital_agent with that booth_number assigned to this monitor
  SELECT
    bn.monitor_id,
    bn.constituency_id,
    COUNT(*) AS vacant_booths
  FROM booth_numbers bn
  LEFT JOIN digital_agents da
    ON da.assigned_monitor_id = bn.monitor_id
    AND da.booth_number = bn.booth_num
  WHERE da.id IS NULL
  GROUP BY bn.monitor_id, bn.constituency_id
),
totals AS (
  SELECT
    assigned_monitor_id AS monitor_id,
    COUNT(*)                                                          AS total_agents,
    COUNT(*) FILTER (
      WHERE
        (fb_url IS NULL OR fb_url = ''
         OR fb_url !~ '^(https?://|www\.).+\..+')
        OR
        (ig_url IS NULL OR ig_url = ''
         OR ig_url !~ '^(https?://|www\.).+\..+')
    )                                                                 AS link_issues
  FROM digital_agents
  WHERE assigned_monitor_id IS NOT NULL
  GROUP BY assigned_monitor_id
)
SELECT
  t.monitor_id,
  COALESCE(v.constituency_id,
    (SELECT constituency_id FROM digital_agents
     WHERE assigned_monitor_id = t.monitor_id LIMIT 1)
  )                         AS constituency_id,
  t.total_agents,
  t.link_issues,
  COALESCE(v.vacant_booths, 0) AS vacant_booths
FROM totals t
LEFT JOIN vacant v ON v.monitor_id = t.monitor_id;

GRANT SELECT ON monitor_field_ops_stats TO authenticated;

-- ============================================================
-- VIEW: constituency_field_ops_stats
-- Same aggregation but at constituency level for the collapsed header row.
-- ============================================================
CREATE OR REPLACE VIEW constituency_field_ops_stats AS
WITH vacant AS (
  SELECT
    mba.constituency_id,
    COUNT(*) AS vacant_booths
  FROM (
    SELECT mba2.constituency_id, generate_series(mba2.booth_from, mba2.booth_to) AS booth_num, mba2.monitor_id
    FROM monitor_booth_assignments mba2
  ) mba
  LEFT JOIN digital_agents da
    ON da.constituency_id = mba.constituency_id
    AND da.booth_number = mba.booth_num
  WHERE da.id IS NULL
  GROUP BY mba.constituency_id
),
totals AS (
  SELECT
    constituency_id,
    COUNT(*)                                                          AS total_agents,
    COUNT(*) FILTER (
      WHERE
        (fb_url IS NULL OR fb_url = ''
         OR fb_url !~ '^(https?://|www\.).+\..+')
        OR
        (ig_url IS NULL OR ig_url = ''
         OR ig_url !~ '^(https?://|www\.).+\..+')
    )                                                                 AS link_issues
  FROM digital_agents
  GROUP BY constituency_id
)
SELECT
  t.constituency_id,
  t.total_agents,
  t.link_issues,
  COALESCE(v.vacant_booths, 0) AS vacant_booths
FROM totals t
LEFT JOIN vacant v ON v.constituency_id = t.constituency_id;

GRANT SELECT ON constituency_field_ops_stats TO authenticated;

-- ============================================================
-- QUICK RUN: Run these in Supabase SQL Editor to add Field Ops views:
--   DROP VIEW IF EXISTS monitor_field_ops_stats;
--   DROP VIEW IF EXISTS constituency_field_ops_stats;
-- Then re-run the CREATE OR REPLACE VIEW blocks above.
-- ============================================================
