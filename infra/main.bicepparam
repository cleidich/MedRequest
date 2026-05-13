using 'main.bicep'

// MedRequest parameters — works with both `az deployment` and `azd provision`.
// When using azd, AZURE_ENV_NAME is set automatically from the azd environment name.

param environment = readEnvironmentVariable('AZURE_ENV_NAME', 'dev')
param projectName = 'medrequest'
param apimPublisherEmail = 'medrequest-dev@example.com'
param appServicePlanSku = 'B1'
param wafMode = 'Detection'

// SQL AAD admin — set via azd env to the deployer's AAD Object ID.
// If empty, falls back to the managed identity (which can't grant other users access).
param sqlAadAdminObjectId = readEnvironmentVariable('AZURE_SQL_ADMIN_OBJECT_ID', '')
