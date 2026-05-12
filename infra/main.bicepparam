using 'main.bicep'

// Dev environment parameters for MedRequest

param environment = 'dev'
param projectName = 'medrequest'
param apimPublisherEmail = 'medrequest-dev@example.com'
param appServicePlanSku = 'B1'
param wafMode = 'Detection'

// SQL AAD admin — leave empty to use the managed identity as admin
param sqlAadAdminObjectId = ''
