// app-service.bicep — App Service Plan + Web App with managed identity
// Hosts both the Express API and the static frontend
//
// ⚠️ COST NOTE: F1 (free) does not support VNet integration or custom domains.
// B1 is the minimum for VNet integration. Default is B1 for networking support.

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('App Service Plan SKU')
param appServicePlanSku string = 'B1'

@description('User-assigned managed identity resource ID')
param managedIdentityId string

@description('User-assigned managed identity client ID')
param managedIdentityClientId string

@description('App Insights connection string')
param appInsightsConnectionString string

@description('Key Vault URI for app configuration')
param keyVaultUri string

@description('SQL Server FQDN')
param sqlServerFqdn string

@description('SQL Database name')
param sqlDatabaseName string

@description('App Service integration subnet ID')
param appServiceSubnetId string

@description('Log Analytics Workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

@description('Key Vault name for Key Vault reference app settings')
param keyVaultName string

@description('Tags to apply to all resources')
param tags object = {}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-${baseName}'
  location: location
  tags: tags
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-${baseName}'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    virtualNetworkSubnetId: appServiceSubnetId
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: false // B1 supports alwaysOn but keep off for cost
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentityClientId
        }
        {
          name: 'KEY_VAULT_URI'
          value: keyVaultUri
        }
        {
          name: 'DB_SERVER'
          value: sqlServerFqdn
        }
        {
          name: 'DB_NAME'
          value: sqlDatabaseName
        }
        {
          name: 'DB_USE_MANAGED_IDENTITY'
          value: 'true'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APIM_GATEWAY_URL'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/APIM-GATEWAY-URL/)'
        }
        {
          name: 'APIM_SUBSCRIPTION_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/APIM-SUBSCRIPTION-KEY/)'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
          value: '600'
        }
      ]
    }
    keyVaultReferenceIdentity: managedIdentityId
  }
}

// Diagnostic settings for the web app
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${webApp.name}'
  scope: webApp
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
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

@description('Resource ID of the App Service Plan')
output appServicePlanId string = appServicePlan.id

@description('Resource ID of the Web App')
output webAppId string = webApp.id

@description('Name of the Web App')
output webAppName string = webApp.name

@description('Default hostname of the Web App')
output webAppHostname string = webApp.properties.defaultHostName
