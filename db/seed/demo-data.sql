/*
 * MedRequest — Demo Seed Data
 *
 * Two sample hospital tenants, several users per tenant, and sample requests.
 * Uses fixed GUIDs so references are predictable for development.
 *
 * NOTE: RLS is active, so SESSION_CONTEXT must be set before INSERTs into
 * users and requests. We temporarily disable the security policies, seed,
 * then re-enable them.
 */

-- Temporarily disable RLS for seeding
ALTER SECURITY POLICY dbo.UsersFilter    WITH (STATE = OFF);
ALTER SECURITY POLICY dbo.RequestsFilter WITH (STATE = OFF);
GO

-- =============================================================================
-- TENANTS
-- =============================================================================
INSERT INTO tenants (id, name) VALUES
    ('A0000000-0000-0000-0000-000000000001', 'Mercy General Hospital'),
    ('B0000000-0000-0000-0000-000000000002', 'St. Claire Medical Center'),
    ('C0000000-0000-0000-0000-000000000003', 'Harbor Medical Center');

-- =============================================================================
-- USERS — Mercy General Hospital
-- =============================================================================
INSERT INTO users (id, tenant_id, name, role) VALUES
    ('10000000-0000-0000-0000-000000000001', 'A0000000-0000-0000-0000-000000000001', 'Alice Johnson',   'patient'),
    ('10000000-0000-0000-0000-000000000002', 'A0000000-0000-0000-0000-000000000001', 'Bob Williams',    'patient'),
    ('10000000-0000-0000-0000-000000000003', 'A0000000-0000-0000-0000-000000000001', 'Carol Davis',     'concierge'),
    ('10000000-0000-0000-0000-000000000004', 'A0000000-0000-0000-0000-000000000001', 'Dan Martinez',    'case_manager');

-- =============================================================================
-- USERS — St. Claire Medical Center
-- =============================================================================
INSERT INTO users (id, tenant_id, name, role) VALUES
    ('20000000-0000-0000-0000-000000000001', 'B0000000-0000-0000-0000-000000000002', 'Eve Thompson',    'patient'),
    ('20000000-0000-0000-0000-000000000002', 'B0000000-0000-0000-0000-000000000002', 'Frank Lee',       'concierge'),
    ('20000000-0000-0000-0000-000000000003', 'B0000000-0000-0000-0000-000000000002', 'Grace Kim',       'case_manager');

-- =============================================================================
-- REQUESTS — Mercy General Hospital
-- =============================================================================
INSERT INTO requests (id, tenant_id, patient_id, type, subject, body, status) VALUES
    ('C0000000-0000-0000-0000-000000000001',
     'A0000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     'concierge',
     'Extra blanket request',
     'Could I please get an extra blanket? My room is quite cold.',
     'new'),

    ('C0000000-0000-0000-0000-000000000002',
     'A0000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     'feedback',
     'Great nursing staff',
     'I want to compliment the nursing team on the 3rd floor — they have been wonderful.',
     'resolved'),

    ('C0000000-0000-0000-0000-000000000003',
     'A0000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000002',
     'case_manager',
     'Discharge planning question',
     'I would like to discuss my discharge timeline with my case manager.',
     'in_progress');

-- =============================================================================
-- REQUESTS — St. Claire Medical Center
-- =============================================================================
INSERT INTO requests (id, tenant_id, patient_id, type, subject, body, status) VALUES
    ('D0000000-0000-0000-0000-000000000001',
     'B0000000-0000-0000-0000-000000000002',
     '20000000-0000-0000-0000-000000000001',
     'concierge',
     'Menu options',
     'Are there vegetarian options available for dinner tonight?',
     'new'),

    ('D0000000-0000-0000-0000-000000000002',
     'B0000000-0000-0000-0000-000000000002',
     '20000000-0000-0000-0000-000000000001',
     'feedback',
     'Room cleanliness',
     'The room could use more frequent cleaning — especially the bathroom.',
     'new');

-- =============================================================================
-- USERS — Harbor Medical Center
-- =============================================================================
INSERT INTO users (id, tenant_id, name, role) VALUES
    ('30000000-0000-0000-0000-000000000001', 'C0000000-0000-0000-0000-000000000003', 'Henry Park',      'patient'),
    ('30000000-0000-0000-0000-000000000002', 'C0000000-0000-0000-0000-000000000003', 'Isabel Chen',     'concierge'),
    ('30000000-0000-0000-0000-000000000003', 'C0000000-0000-0000-0000-000000000003', 'Jack O''Brien',   'case_manager');

-- =============================================================================
-- REQUESTS — Harbor Medical Center
-- =============================================================================
INSERT INTO requests (id, tenant_id, patient_id, type, subject, body, status) VALUES
    ('E0000000-0000-0000-0000-000000000001',
     'C0000000-0000-0000-0000-000000000003',
     '30000000-0000-0000-0000-000000000001',
     'concierge',
     'Coffee request',
     'Would it be possible to get a cup of coffee? Decaf preferred.',
     'new'),

    ('E0000000-0000-0000-0000-000000000002',
     'C0000000-0000-0000-0000-000000000003',
     '30000000-0000-0000-0000-000000000001',
     'case_manager',
     'Insurance coverage question',
     'I need help understanding what my insurance will cover for the recommended physical therapy.',
     'in_progress');

-- Re-enable RLS
ALTER SECURITY POLICY dbo.UsersFilter    WITH (STATE = ON);
ALTER SECURITY POLICY dbo.RequestsFilter WITH (STATE = ON);
GO
