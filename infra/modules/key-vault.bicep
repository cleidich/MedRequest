// key-vault.bicep — Azure Key Vault with RBAC access (no access policies)
// All secret access is via managed identity role assignments

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('Tenant ID for the Key Vault')
param tenantId string

@description('Principal ID of the managed identity to grant secrets access')
param managedIdentityPrincipalId string

@description('Log Analytics Workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

@description('Tags to apply to all resources')
param tags object = {}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${baseName}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    // enablePurgeProtection omitted — defaults to not enabled (POC cleanup-friendly)
  }
}

// Grant the managed identity "Key Vault Secrets User" role
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource secretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, managedIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Diagnostic settings
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${keyVault.name}'
  scope: keyVault
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

@description('Resource ID of the Key Vault')
output keyVaultId string = keyVault.id

@description('Name of the Key Vault')
output keyVaultName string = keyVault.name

@description('URI of the Key Vault')
output keyVaultUri string = keyVault.properties.vaultUri
