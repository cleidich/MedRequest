// networking.bicep — VNet, subnets, and NSGs for MedRequest
// Subnets: App Gateway, App Service integration, SQL private endpoint
//
// ⚠️ COST NOTE: VNet itself is free, but private endpoints and VNet integration
// on App Service require at least B1 SKU (not F1). App Gateway Standard_v2
// has a base hourly cost (~$0.20/hr). Flag these to the team if budget is tight.

@description('Azure region for deployment')
param location string

@description('Base name for resource naming')
param baseName string

@description('VNet address space')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('App Gateway subnet CIDR')
param appGatewaySubnetPrefix string = '10.0.1.0/24'

@description('App Service integration subnet CIDR')
param appServiceSubnetPrefix string = '10.0.2.0/24'

@description('Private endpoint subnet CIDR (SQL, etc.)')
param privateEndpointSubnetPrefix string = '10.0.3.0/24'

@description('Tags to apply to all resources')
param tags object = {}

// --- NSGs ---

resource nsgAppGateway 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${baseName}-appgw'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHTTP'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowGatewayManager'
        properties: {
          priority: 120
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'GatewayManager'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '65200-65535'
        }
      }
    ]
  }
}

resource nsgAppService 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${baseName}-appsvc'
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

resource nsgPrivateEndpoint 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${baseName}-pe'
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

// --- VNet ---

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-${baseName}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: 'snet-appgw'
        properties: {
          addressPrefix: appGatewaySubnetPrefix
          networkSecurityGroup: {
            id: nsgAppGateway.id
          }
        }
      }
      {
        name: 'snet-appsvc'
        properties: {
          addressPrefix: appServiceSubnetPrefix
          networkSecurityGroup: {
            id: nsgAppService.id
          }
          delegations: [
            {
              name: 'Microsoft.Web.serverFarms'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'snet-pe'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          networkSecurityGroup: {
            id: nsgPrivateEndpoint.id
          }
        }
      }
    ]
  }
}

@description('Resource ID of the VNet')
output vnetId string = vnet.id

@description('Name of the VNet')
output vnetName string = vnet.name

@description('Resource ID of the App Gateway subnet')
output appGatewaySubnetId string = vnet.properties.subnets[0].id

@description('Resource ID of the App Service integration subnet')
output appServiceSubnetId string = vnet.properties.subnets[1].id

@description('Resource ID of the private endpoint subnet')
output privateEndpointSubnetId string = vnet.properties.subnets[2].id
