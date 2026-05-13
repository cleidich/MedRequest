using 'main.bicep'

// MedRequest parameters — works with both `az deployment` and `azd provision`.
// When using azd, AZURE_ENV_NAME is set automatically from the azd environment name.

param environment = readEnvironmentVariable('AZURE_ENV_NAME', 'dev')
param projectName = 'medrequest'
param apimPublisherEmail = 'medrequest-dev@example.com'
param appServicePlanSku = 'B1'
param wafMode = 'Detection'

// SQL AAD admin — leave empty to use the managed identity as admin
param sqlAadAdminObjectId = ''
