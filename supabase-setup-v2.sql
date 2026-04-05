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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Monitors can read their own assignments
CREATE POLICY IF NOT EXISTS "Monitors read own booth assignments"
  ON monitor_booth_assignments FOR SELECT
  USING (monitor_id = auth.uid());

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
