// sql.bicep — Azure SQL Server + Database (Basic/5 DTU)
// Uses AAD-only auth with managed identity — no SQL passwords
//
// ⚠️ COST NOTE: The SQL private endpoint in the VNet is free for the endpoint
// itself, but the private DNS zone adds minor cost. Acceptable for POC.

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('AAD admin object ID (the managed identity or admin user)')
param aadAdminObjectId string

@description('AAD admin display name')
param aadAdminName string = 'MedRequest Admin'

@description('Principal type for the AAD admin (User or Application)')
param aadAdminPrincipalType string = 'User'

@description('AAD admin tenant ID')
param tenantId string

@description('SQL Database SKU name')
param sqlSkuName string = 'Basic'

@description('SQL Database DTU capacity')
param sqlDtuCapacity int = 5

@description('Private endpoint subnet ID (for SQL private endpoint)')
param privateEndpointSubnetId string

@description('VNet ID for private DNS zone link')
param vnetId string

@description('Log Analytics Workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

@description('Tags to apply to all resources')
param tags object = {}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: 'sql-${baseName}'
  location: location
  tags: tags
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      login: aadAdminName
      sid: aadAdminObjectId
      tenantId: tenantId
      principalType: aadAdminPrincipalType
    }
    minimalTlsVersion: '1.2'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'medrequest'
  location: location
  tags: tags
  sku: {
    name: sqlSkuName
    capacity: sqlDtuCapacity
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2 GB
  }
}

// Allow Azure services to access (needed for App Service connectivity)
resource firewallAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Private endpoint for SQL Server
resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pe-${sqlServer.name}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'sql-connection'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: [
            'sqlServer'
          ]
        }
      }
    ]
  }
}

// Private DNS zone for SQL
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink${environment().suffixes.sqlServerHostname}'
  location: 'global'
  tags: tags
}

resource privateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${baseName}-sql-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: sqlPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'sqlConfig'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

// Diagnostic settings for SQL Database
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${sqlDatabase.name}'
  scope: sqlDatabase
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'SQLSecurityAuditEvents'
        enabled: true
      }
      {
        category: 'QueryStoreRuntimeStatistics'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Basic'
        enabled: true
      }
    ]
  }
}

@description('Resource ID of the SQL Server')
output sqlServerId string = sqlServer.id

@description('Fully qualified domain name of the SQL Server')
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName

@description('Name of the SQL Server')
output sqlServerName string = sqlServer.name

@description('Name of the SQL Database')
output sqlDatabaseName string = sqlDatabase.name
