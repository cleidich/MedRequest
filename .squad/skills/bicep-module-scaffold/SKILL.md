# Skill: Bicep Module Scaffold

## Pattern
Each Azure resource gets its own Bicep module under `infra/modules/` with a consistent structure:

### Module Template
```bicep
// {resource}.bicep — {Description}
@description('Azure region') param location string
@description('Base name for naming') param baseName string
@description('Log Analytics Workspace ID') param logAnalyticsWorkspaceId string
@description('Tags') param tags object = {}

resource theResource '...' = {
  name: '{prefix}-${baseName}'
  location: location
  tags: tags
  // ...
}

// Diagnostic settings (every resource)
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${theResource.name}'
  scope: theResource
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [ { categoryGroup: 'allLogs', enabled: true } ]
    metrics: [ { category: 'AllMetrics', enabled: true } ]
  }
}

// Outputs: resource ID + name + any connection info
output resourceId string = theResource.id
output resourceName string = theResource.name
```

### Naming Convention
Use Azure CAF abbreviations: `app-`, `func-`, `sql-`, `kv-`, `apim-`, `appgw-`, `log-`, `appi-`, `st`, `vnet-`, `id-`, `nsg-`, `pip-`, `pe-`

### Orchestrator Pattern
`main.bicep` composes modules in dependency order, passing outputs between them. Identity and monitoring deploy first (no dependencies), then everything else.

## When to Use
- Adding a new Azure resource to the project
- Refactoring existing Bicep into modular structure
- Ensuring consistent diagnostics and tagging across resources
