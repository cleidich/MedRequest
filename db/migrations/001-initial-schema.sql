/*
 * MedRequest — Initial Database Schema
 * Migration: 001-initial-schema.sql
 *
 * Multi-tenant schema using Row-Level Security (RLS) with SESSION_CONTEXT.
 * Each connection sets SESSION_CONTEXT('tenant_id') via middleware, and RLS
 * policies transparently filter all queries to the active tenant.
 */

-- =============================================================================
-- TENANTS
-- =============================================================================
CREATE TABLE tenants (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name        NVARCHAR(255)    NOT NULL,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE users (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id   UNIQUEIDENTIFIER NOT NULL,
    name        NVARCHAR(255)    NOT NULL,
    role        NVARCHAR(20)     NOT NULL
        CONSTRAINT CK_users_role CHECK (role IN ('patient', 'concierge', 'case_manager')),
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- =============================================================================
-- REQUESTS
-- =============================================================================
CREATE TABLE requests (
    id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenant_id   UNIQUEIDENTIFIER NOT NULL,
    patient_id  UNIQUEIDENTIFIER NOT NULL,
    type        NVARCHAR(20)     NOT NULL
        CONSTRAINT CK_requests_type CHECK (type IN ('feedback', 'concierge', 'case_manager')),
    subject     NVARCHAR(500)    NOT NULL,
    body        NVARCHAR(MAX)    NULL,
    status      NVARCHAR(20)     NOT NULL DEFAULT 'new'
        CONSTRAINT CK_requests_status CHECK (status IN ('new', 'in_progress', 'resolved', 'forwarded')),
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_requests_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
    CONSTRAINT FK_requests_patient FOREIGN KEY (patient_id) REFERENCES users(id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IX_users_tenant_id        ON users    (tenant_id);
CREATE INDEX IX_requests_tenant_id     ON requests (tenant_id);
CREATE INDEX IX_requests_patient_id    ON requests (patient_id);
CREATE INDEX IX_requests_status        ON requests (status);
CREATE INDEX IX_requests_created_at    ON requests (created_at);
CREATE INDEX IX_requests_tenant_status ON requests (tenant_id, status, created_at);

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- =============================================================================

-- Security predicate function: returns rows where tenant_id matches SESSION_CONTEXT
CREATE FUNCTION dbo.fn_tenant_filter(@tenant_id UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS
    RETURN SELECT 1 AS result
    WHERE @tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS UNIQUEIDENTIFIER);
GO

-- Apply RLS policy to users table
CREATE SECURITY POLICY dbo.UsersFilter
    ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.users,
    ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.users AFTER INSERT
    WITH (STATE = ON);
GO

-- Apply RLS policy to requests table
CREATE SECURITY POLICY dbo.RequestsFilter
    ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.requests,
    ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.requests AFTER INSERT
    WITH (STATE = ON);
GO
