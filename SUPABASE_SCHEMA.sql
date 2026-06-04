-- ============================================================
-- HCT INVENTORY MANAGEMENT SYSTEM — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('viewer', 'staff', 'custodian', 'supply_officer', 'admin');
CREATE TYPE item_category AS ENUM ('Equipment', 'Consumable', 'Furniture', 'Medical Supply', 'Simulation Material', 'Technology', 'Other');
CREATE TYPE item_status AS ENUM ('Functional', 'Not Functional', 'Under Repair', 'Missing');
CREATE TYPE unit_type AS ENUM ('Piece(s)', 'Box(es)', 'Set(s)', 'Pack(s)', 'Bottle(s)', 'Other');
CREATE TYPE transaction_type AS ENUM ('Stock In', 'Stock Out', 'Transfer', 'Return', 'Adjustment');
CREATE TYPE request_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
CREATE TYPE request_status AS ENUM ('Pending', 'Approved', 'Released', 'Denied', 'Returned');
CREATE TYPE audit_action AS ENUM ('Created', 'Edited', 'Deleted', 'Restored', 'Exported', 'Approved', 'Released', 'Denied', 'Transferred', 'Login', 'Logout');
CREATE TYPE audit_record_type AS ENUM ('Inventory Item', 'VR Asset', 'Request', 'Transaction', 'User', 'Room');

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,           -- e.g. '5th-icu'
  name        TEXT NOT NULL,
  floor       TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'box',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rooms (code, name, floor, abbreviation, icon) VALUES
  ('5th-icu',  'Intensive Care Unit',        '5th Floor', 'ICU', 'activity'),
  ('5th-aha',  'American Heart Association', '5th Floor', 'AHA', 'heart'),
  ('5th-or',   'Operating Room',             '5th Floor', 'OR',  'scissors'),
  ('5th-dr',   'Delivery Room',              '5th Floor', 'DR',  'baby'),
  ('3rd-icu',  'Intensive Care Unit',        '3rd Floor', 'ICU', 'activity'),
  ('3rd-or',   'Operating Room',             '3rd Floor', 'OR',  'scissors'),
  ('3rd-dr',   'Delivery Room',              '3rd Floor', 'DR',  'baby'),
  ('3rd-vr',   'Virtual Reality',            '3rd Floor', 'VR',  'monitor'),
  ('3rd-care', 'Caregiving',                 '3rd Floor', 'CG',  'users'),
  ('3rd-ems',  'EMS',                        '3rd Floor', 'EMS', 'truck'),
  ('csr',      'Central Supply Room',        'Central',   'CSR', 'archive');

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'viewer',
  assigned_rooms TEXT[] DEFAULT '{}',     -- room codes custodian is responsible for
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================
CREATE TABLE inventory_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag       TEXT UNIQUE,                      -- e.g. HCT-ICU-0001
  name            TEXT NOT NULL,
  category        item_category NOT NULL DEFAULT 'Equipment',
  quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit            unit_type NOT NULL DEFAULT 'Piece(s)',
  status          item_status NOT NULL DEFAULT 'Functional',
  room_id         UUID NOT NULL REFERENCES rooms(id),
  location_detail TEXT,                             -- shelf/bin within room
  remarks         TEXT,
  image_url       TEXT,
  is_deleted      BOOLEAN DEFAULT FALSE,            -- soft delete
  deleted_by      UUID REFERENCES profiles(id),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      UUID REFERENCES profiles(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_room ON inventory_items(room_id);
CREATE INDEX idx_inventory_status ON inventory_items(status);
CREATE INDEX idx_inventory_deleted ON inventory_items(is_deleted);
CREATE INDEX idx_inventory_asset_tag ON inventory_items(asset_tag);

-- ============================================================
-- INVENTORY TRANSACTIONS (movement history)
-- ============================================================
CREATE TABLE inventory_transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id             UUID NOT NULL REFERENCES inventory_items(id),
  transaction_type    transaction_type NOT NULL,
  quantity_change     INTEGER NOT NULL,             -- positive = in, negative = out
  quantity_before     INTEGER NOT NULL,
  quantity_after      INTEGER NOT NULL,
  from_room_id        UUID REFERENCES rooms(id),    -- for Transfer
  to_room_id          UUID REFERENCES rooms(id),    -- for Transfer
  reference_number    TEXT,                         -- PO/DR/request number
  notes               TEXT,
  performed_by        UUID REFERENCES profiles(id),
  performed_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_item ON inventory_transactions(item_id);
CREATE INDEX idx_tx_performed_at ON inventory_transactions(performed_at DESC);

-- ============================================================
-- VR ASSETS
-- ============================================================
CREATE TABLE vr_assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vr_number       TEXT UNIQUE NOT NULL,             -- VR-001
  serial_number   TEXT,
  brand           TEXT,
  model           TEXT,
  room_id         UUID REFERENCES rooms(id),
  status          item_status NOT NULL DEFAULT 'Functional',
  last_maintenance DATE,
  notes           TEXT,
  asset_tag       TEXT,
  is_deleted      BOOLEAN DEFAULT FALSE,
  deleted_by      UUID REFERENCES profiles(id),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      UUID REFERENCES profiles(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vr_room ON vr_assets(room_id);
CREATE INDEX idx_vr_deleted ON vr_assets(is_deleted);

-- ============================================================
-- REQUESTS
-- ============================================================
CREATE TABLE requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_name  TEXT NOT NULL,
  department      TEXT,
  date_requested  DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name       TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  reason          TEXT,
  priority        request_priority NOT NULL DEFAULT 'Medium',
  status          request_status NOT NULL DEFAULT 'Pending',
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  submitted_by    UUID REFERENCES profiles(id),
  is_deleted      BOOLEAN DEFAULT FALSE,
  deleted_by      UUID REFERENCES profiles(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_req_status ON requests(status);
CREATE INDEX idx_req_deleted ON requests(is_deleted);

-- ============================================================
-- AUDIT LOGS (OWASP-compliant application-level logging)
-- ============================================================
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type     audit_action NOT NULL,
  record_type     audit_record_type NOT NULL,
  record_id       UUID,                             -- ID of affected record
  record_label    TEXT,                             -- human-readable name
  old_value       JSONB,                            -- previous state
  new_value       JSONB,                            -- new state
  changed_by_id   UUID REFERENCES profiles(id),
  changed_by_name TEXT,                             -- denormalized for history
  changed_by_role TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  session_id      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_record ON audit_logs(record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(changed_by_id);
CREATE INDEX idx_audit_action ON audit_logs(action_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Rooms: everyone can read
CREATE POLICY "rooms_read_all" ON rooms FOR SELECT USING (TRUE);

-- Profiles: users see own profile; admins see all
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_read_admin" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Inventory: all authenticated users can read non-deleted items
CREATE POLICY "inventory_read" ON inventory_items FOR SELECT USING (
  auth.role() = 'authenticated'
);
-- Insert: custodian (own rooms), supply_officer (CSR), admin
CREATE POLICY "inventory_insert" ON inventory_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN rooms r ON r.id = NEW.room_id
    WHERE p.id = auth.uid() AND (
      p.role IN ('admin', 'supply_officer') OR
      (p.role = 'custodian' AND r.code = ANY(p.assigned_rooms))
    )
  )
);
-- Update: same as insert
CREATE POLICY "inventory_update" ON inventory_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN rooms r ON r.id = room_id
    WHERE p.id = auth.uid() AND (
      p.role IN ('admin', 'supply_officer') OR
      (p.role = 'custodian' AND r.code = ANY(p.assigned_rooms))
    )
  )
);

-- Transactions: authenticated can read; custodian+ can insert
CREATE POLICY "tx_read" ON inventory_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tx_insert" ON inventory_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('custodian','supply_officer','admin'))
);

-- VR Assets: authenticated read; supply_officer/admin write
CREATE POLICY "vr_read" ON vr_assets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vr_write" ON vr_assets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supply_officer','admin'))
);

-- Requests: authenticated can read; staff+ can insert; supply_officer/admin can update
CREATE POLICY "req_read" ON requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "req_insert" ON requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','custodian','supply_officer','admin'))
);
CREATE POLICY "req_update" ON requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supply_officer','admin'))
);

-- Audit logs: admin only for full access; own entries visible to authenticated
CREATE POLICY "audit_read_admin" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- HELPER FUNCTION: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'viewer'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- HELPER FUNCTION: generate asset tag
-- ============================================================
CREATE OR REPLACE FUNCTION generate_asset_tag(room_code TEXT, category TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  prefix TEXT;
  count_val INTEGER;
  tag TEXT;
BEGIN
  prefix := 'HCT-' || UPPER(REPLACE(room_code, '-', '')) || '-';
  SELECT COUNT(*) + 1 INTO count_val
  FROM inventory_items
  WHERE room_id = (SELECT id FROM rooms WHERE code = room_code);
  tag := prefix || LPAD(count_val::TEXT, 4, '0');
  RETURN tag;
END;
$$;

-- ============================================================
-- ANON ACCESS: Allow unauthenticated users to view public data
-- (The app will use magic link / email login — viewers get anon access)
-- ============================================================
-- Grant anon read on rooms only (everything else requires login)
CREATE POLICY "rooms_anon_read" ON rooms FOR SELECT TO anon USING (TRUE);

GRANT SELECT ON rooms TO anon;
GRANT SELECT ON rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON inventory_items TO authenticated;
GRANT SELECT, INSERT ON inventory_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON vr_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON requests TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
