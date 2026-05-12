// apim.bicep — Azure API Management (Consumption tier)
// Frontend API gateway for patient-facing app and future integrations
//
// ⚠️ COST NOTE: Consumption tier runs outside VNet (no VNet injection).
// Traffic flows: Internet → App Gateway → APIM → App Service.
// Consumption APIM has no monthly base cost — pay per call only.

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('Publisher email for APIM')
param publisherEmail string

@description('Publisher name for APIM')
param publisherName string = 'MedRequest Team'

@description('App Insights resource ID for APIM logger')
param appInsightsId string

@description('App Insights instrumentation key')
param appInsightsInstrumentationKey string

@description('Backend Web App hostname')
param backendHostname string

@description('Log Analytics Workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

@description('Tags to apply to all resources')
param tags object = {}

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: 'apim-${baseName}'
  location: location
  tags: tags
  sku: {
    name: 'Consumption'
    capacity: 0
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

// App Insights logger for APIM
resource apimLogger 'Microsoft.ApiManagement/service/loggers@2023-09-01-preview' = {
  parent: apim
  name: 'appinsights-logger'
  properties: {
    loggerType: 'applicationInsights'
    resourceId: appInsightsId
    credentials: {
      instrumentationKey: appInsightsInstrumentationKey
    }
  }
}

// Backend pointing to the App Service
resource apimBackend 'Microsoft.ApiManagement/service/backends@2023-09-01-preview' = {
  parent: apim
  name: 'medrequest-backend'
  properties: {
    protocol: 'http'
    url: 'https://${backendHostname}'
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// Diagnostic settings
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${apim.name}'
  scope: apim
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

@description('Resource ID of the APIM instance')
output apimId string = apim.id

@description('Name of the APIM instance')
output apimName string = apim.name

@description('Gateway URL of the APIM instance')
output apimGatewayUrl string = apim.properties.gatewayUrl
