// managed-identity.bicep — User-assigned managed identity for MedRequest
// Used by App Service, Functions, and other resources to access Key Vault, SQL, Storage

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('Tags to apply to all resources')
param tags object = {}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${baseName}'
  location: location
  tags: tags
}

@description('Resource ID of the managed identity')
output identityId string = managedIdentity.id

@description('Principal ID (object ID) of the managed identity')
output principalId string = managedIdentity.properties.principalId

@description('Client ID of the managed identity')
output clientId string = managedIdentity.properties.clientId

@description('Name of the managed identity')
output identityName string = managedIdentity.name
