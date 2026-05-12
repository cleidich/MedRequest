// monitoring.bicep — Log Analytics Workspace + Application Insights
// Single workspace for all resources per project convention (POC simplicity)

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('Log Analytics SKU')
param logAnalyticsSku string = 'PerGB2018'

@description('Log Analytics retention in days')
param retentionInDays int = 30

@description('Tags to apply to all resources')
param tags object = {}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${baseName}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: logAnalyticsSku
    }
    retentionInDays: retentionInDays
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${baseName}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
  }
}

@description('Resource ID of the Log Analytics Workspace')
output logAnalyticsId string = logAnalytics.id

@description('Name of the Log Analytics Workspace')
output logAnalyticsName string = logAnalytics.name

@description('Resource ID of Application Insights')
output appInsightsId string = appInsights.id

@description('Name of Application Insights')
output appInsightsName string = appInsights.name

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.properties.ConnectionString
