// main.bicep — MedRequest infrastructure orchestrator
// Composes all modules to deploy the full environment
//
// Usage:
//   az deployment group create \
//     --resource-group rg-medrequest-dev \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam

targetScope = 'resourceGroup'

// --- Core Parameters ---

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Project base name used for resource naming')
param projectName string = 'medrequest'

@description('APIM publisher email')
param apimPublisherEmail string

@description('AAD admin object ID for SQL Server')
param sqlAadAdminObjectId string = ''

@description('WAF mode: Detection or Prevention')
param wafMode string = 'Detection'

@description('App Service Plan SKU (F1 = free, B1 = basic with VNet support)')
param appServicePlanSku string = 'B1'

@description('Tags applied to all resources')
param tags object = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
}

// --- Derived naming ---
var baseName = '${projectName}-${environment}'

// Deterministic resource names/URLs (avoids circular module dependencies)
var keyVaultName = 'kv-${baseName}'
var apimGatewayUrl = 'https://apim-${baseName}.azure-api.net'

// --- Modules ---

// 1. Managed Identity — created first, referenced by everything
module identity 'modules/managed-identity.bicep' = {
  name: 'identity-deploy'
  params: {
    location: location
    baseName: baseName
    tags: tags
  }
}

// 2. Networking — VNet, subnets, NSGs
module networking 'modules/networking.bicep' = {
  name: 'networking-deploy'
  params: {
    location: location
    baseName: baseName
    tags: tags
  }
}

// 3. Monitoring — Log Analytics + App Insights (needed by most other modules)
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deploy'
  params: {
    location: location
    baseName: baseName
    tags: tags
  }
}

// 4. Key Vault — RBAC-based, grants access to managed identity, stores APIM secrets
// Uses computed APIM gateway URL to avoid circular dependency (APIM → App Service → Key Vault)
module keyVault 'modules/key-vault.bicep' = {
  name: 'keyvault-deploy'
  params: {
    location: location
    baseName: baseName
    tenantId: subscription().tenantId
    managedIdentityPrincipalId: identity.outputs.principalId
    apimGatewayUrl: apimGatewayUrl
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// 5. Storage — Blob storage for app resources
module storage 'modules/storage.bicep' = {
  name: 'storage-deploy'
  params: {
    location: location
    baseName: baseName
    managedIdentityPrincipalId: identity.outputs.principalId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// 6. SQL — Azure SQL Server + Database with private endpoint
module sql 'modules/sql.bicep' = {
  name: 'sql-deploy'
  params: {
    location: location
    baseName: baseName
    aadAdminObjectId: sqlAadAdminObjectId != '' ? sqlAadAdminObjectId : identity.outputs.principalId
    tenantId: subscription().tenantId
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// 7. App Service — Express API + frontend hosting
module appService 'modules/app-service.bicep' = {
  name: 'appservice-deploy'
  params: {
    location: location
    baseName: baseName
    appServicePlanSku: appServicePlanSku
    managedIdentityId: identity.outputs.identityId
    managedIdentityClientId: identity.outputs.clientId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    keyVaultUri: keyVault.outputs.keyVaultUri
    keyVaultName: keyVaultName
    sqlServerFqdn: sql.outputs.sqlServerFqdn
    sqlDatabaseName: sql.outputs.sqlDatabaseName
    appServiceSubnetId: networking.outputs.appServiceSubnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// 8. Functions — Consumption plan for outbound integrations
module functions 'modules/functions.bicep' = {
  name: 'functions-deploy'
  params: {
    location: location
    baseName: baseName
    managedIdentityId: identity.outputs.identityId
    managedIdentityClientId: identity.outputs.clientId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// 9. APIM — API Management (Consumption tier)
module apim 'modules/apim.bicep' = {
  name: 'apim-deploy'
  params: {
    location: location
    baseName: baseName
    publisherEmail: apimPublisherEmail
    appInsightsId: monitoring.outputs.appInsightsId
    appInsightsInstrumentationKey: monitoring.outputs.appInsightsInstrumentationKey
    backendHostname: appService.outputs.webAppHostname
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// 10. APIM subscription key → Key Vault (auto-retrieved, no manual step needed)
// References the built-in all-access subscription after APIM deploys, then stores the
// primary key in Key Vault so App Service can read it via Key Vault reference.
resource apimInstance 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
  name: 'apim-${baseName}'
}

resource apimBuiltInSubscription 'Microsoft.ApiManagement/service/subscriptions@2023-09-01-preview' existing = {
  name: 'master'
  parent: apimInstance
}

resource apimKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVaultName}/APIM-SUBSCRIPTION-KEY'
  properties: {
    value: apimBuiltInSubscription.listSecrets().primaryKey
  }
  dependsOn: [
    apim
    keyVault
  ]
}

// 11. App Gateway — WAF-enabled entry point
module appGateway 'modules/app-gateway.bicep' = {
  name: 'appgateway-deploy'
  params: {
    location: location
    baseName: baseName
    appGatewaySubnetId: networking.outputs.appGatewaySubnetId
    backendFqdn: appService.outputs.webAppHostname
    wafMode: wafMode
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    tags: tags
  }
}

// --- Outputs ---
// Note: azd automatically maps these to env vars accessible in hook scripts.

@description('Web App default hostname')
output webAppHostname string = appService.outputs.webAppHostname

@description('Function App default hostname')
output functionAppHostname string = functions.outputs.functionAppHostname

@description('APIM gateway URL')
output apimGatewayUrl string = apim.outputs.apimGatewayUrl

@description('SQL Server FQDN')
output sqlServerFqdn string = sql.outputs.sqlServerFqdn

@description('Key Vault URI')
output keyVaultUri string = keyVault.outputs.keyVaultUri

@description('App Insights name')
output appInsightsName string = monitoring.outputs.appInsightsName

@description('Storage account name')
output storageAccountName string = storage.outputs.storageAccountName

// --- azd hook outputs (consumed by postprovision.sh and postdeploy.sh) ---

@description('SQL Server name (without .database.windows.net)')
output AZURE_SQL_SERVER_NAME string = sql.outputs.sqlServerName

@description('SQL Database name')
output AZURE_SQL_DATABASE_NAME string = sql.outputs.sqlDatabaseName

@description('Managed identity name')
output AZURE_MANAGED_IDENTITY_NAME string = identity.outputs.identityName

@description('App Service name')
output AZURE_APP_SERVICE_NAME string = appService.outputs.webAppName
