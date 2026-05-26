// apim.bicep — Azure API Management (Basic v2 tier)
// Frontend API gateway for patient-facing app and future integrations
//
// ⚠️ COST NOTE: Basic v2 is dedicated compute (~$150/month). No cold starts,
// no race conditions on provisioning, and includes SLA.
// Traffic flows: Internet → App Gateway → APIM → App Service.

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

@secure()
@description('Gateway secret for APIM-to-backend validation')
param gatewaySecret string

resource apim 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: 'apim-${baseName}'
  location: location
  tags: tags
  sku: {
    name: 'Basicv2'
    capacity: 1
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

// App Insights logger for APIM
resource apimLogger 'Microsoft.ApiManagement/service/loggers@2024-05-01' = {
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
resource apimBackend 'Microsoft.ApiManagement/service/backends@2024-05-01' = {
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

// Named value for gateway secret
resource gatewaySecretNamedValue 'Microsoft.ApiManagement/service/namedValues@2024-05-01' = {
  parent: apim
  name: 'gateway-secret'
  properties: {
    displayName: 'gateway-secret'
    value: gatewaySecret
    secret: true
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

// --- API definition: MedRequest API ---

resource api 'Microsoft.ApiManagement/service/apis@2024-05-01' = {
  parent: apim
  name: 'medrequest-api'
  properties: {
    displayName: 'MedRequest API'
    path: 'medrequest'
    protocols: [
      'https'
    ]
    serviceUrl: 'https://${backendHostname}'
    subscriptionRequired: true
    subscriptionKeyParameterNames: {
      header: 'Ocp-Apim-Subscription-Key'
      query: 'subscription-key'
    }
  }
}

// API-level policy: rate limit, CORS, header passthrough, backend service
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2024-05-01' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'xml'
    value: '''
<policies>
  <inbound>
    <base />
    <rate-limit calls="100" renewal-period="60" />
    <cors>
      <allowed-origins>
        <origin>*</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
        <method>POST</method>
        <method>PATCH</method>
        <method>PUT</method>
        <method>DELETE</method>
        <method>OPTIONS</method>
      </allowed-methods>
      <allowed-headers>
        <header>*</header>
      </allowed-headers>
    </cors>
    <set-header name="X-Tenant-Id" exists-action="override">
      <value>@(context.Request.Headers.GetValueOrDefault("X-Tenant-Id",""))</value>
    </set-header>
    <set-header name="X-User-Id" exists-action="override">
      <value>@(context.Request.Headers.GetValueOrDefault("X-User-Id",""))</value>
    </set-header>
    <set-header name="X-User-Role" exists-action="override">
      <value>@(context.Request.Headers.GetValueOrDefault("X-User-Role",""))</value>
    </set-header>
    <set-header name="X-Gateway-Key" exists-action="override">
      <value>{{gateway-secret}}</value>
    </set-header>
    <set-backend-service backend-id="medrequest-backend" />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>'''
  }
  dependsOn: [
    apimBackend
    gatewaySecretNamedValue
  ]
}

// --- API Operations (11 total, matching live configuration) ---

resource opGetHealth 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'getHealth'
  properties: {
    displayName: 'Liveness probe'
    method: 'GET'
    urlTemplate: '/api/health'
    description: 'Liveness probe'
  }
}

resource opGetReady 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'getReady'
  properties: {
    displayName: 'Readiness probe'
    method: 'GET'
    urlTemplate: '/api/ready'
    description: 'Readiness probe'
  }
}

resource opListRequests 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'listRequests'
  properties: {
    displayName: 'List requests for the current tenant'
    method: 'GET'
    urlTemplate: '/api/requests'
    description: 'List requests for the current tenant'
  }
}

resource opGetRequest 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'getRequest'
  properties: {
    displayName: 'Get a single request by ID'
    method: 'GET'
    urlTemplate: '/api/requests/{id}'
    description: 'Get a single request by ID'
    templateParameters: [
      {
        name: 'id'
        type: 'string'
        required: true
      }
    ]
  }
}

resource opCreateRequest 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'createRequest'
  properties: {
    displayName: 'Create a new patient request'
    method: 'POST'
    urlTemplate: '/api/requests'
    description: 'Create a new patient request'
  }
}

resource opUpdateRequestStatus 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'updateRequestStatus'
  properties: {
    displayName: 'Update request status'
    method: 'PATCH'
    urlTemplate: '/api/requests/{id}'
    description: 'Update request status'
    templateParameters: [
      {
        name: 'id'
        type: 'string'
        required: true
      }
    ]
  }
}

resource opGetIntegrationRequests 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'getIntegrationRequests'
  properties: {
    displayName: 'Pull requests for integration consumers'
    method: 'GET'
    urlTemplate: '/api/integration/requests'
    description: 'Pull requests for integration consumers'
  }
}

resource opForwardToEmr 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'forwardToEmr'
  properties: {
    displayName: 'Forward a request to the EMR system'
    method: 'POST'
    urlTemplate: '/api/integration/forward-emr'
    description: 'Forward a request to the EMR system'
  }
}

resource opForwardToBusinessOffice 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'forwardToBusinessOffice'
  properties: {
    displayName: 'Forward a request to the business office'
    method: 'POST'
    urlTemplate: '/api/integration/forward-business-office'
    description: 'Forward a request to the business office'
  }
}

resource opSendNotification 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'sendNotification'
  properties: {
    displayName: 'Send notification for a request'
    method: 'POST'
    urlTemplate: '/api/integration/notify'
    description: 'Send notification for a request'
  }
}

resource opDebugExplore 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'debugExplore'
  properties: {
    displayName: 'Behind the Scenes SQL Explorer'
    method: 'POST'
    urlTemplate: '/api/debug/explore'
    description: 'Runs predefined RLS-aware queries against the database for demo purposes.'
  }
}

// Built-in "master" subscription — safe to reference here because `apim` is created above
resource builtInSubscription 'Microsoft.ApiManagement/service/subscriptions@2024-05-01' existing = {
  name: 'master'
  parent: apim
}

@description('Resource ID of the APIM instance')
output apimId string = apim.id

@description('Name of the APIM instance')
output apimName string = apim.name

@description('Symbolic name of the APIM service (for existing-resource lookups)')
output apimServiceName string = apim.name

@description('Gateway URL of the APIM instance')
output apimGatewayUrl string = apim.properties.gatewayUrl

@description('APIM built-in subscription primary key')
@secure()
output apimSubscriptionKey string = builtInSubscription.listSecrets().primaryKey
