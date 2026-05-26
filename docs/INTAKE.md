# Application Intake

## Overview

<!-- A brief description of the application: what it does, who it's for, and the core problem it solves. -->
"MedRequest" is an application used by patients in inpatient hospital stays, to send feedback and request concierge-type services from the hospital, using their smartphone for maximum convenience and safety. It allows patients to request non-urgent comfort items, service items, or staff member assistance.

**Note**: This application is a demo. We'll want to demonstrate a simple web frontend with backend, and demonstrate things like APIM gateway security, but additional features like EMR integration do not need to be operational.

## Key Features

<!-- List the primary capabilities of the application. Focus on what users can do. -->

- Web-based front end with responsive design, optimized for phone and tablet.
- Secure database backend to log requests
- Robust frontend APIs for both patient requets submissions (from front-end) and for querying the system for new requests, (i.e., a pull architecture, to move requests into an EMR or communications system)
- Front-end security with Azure API Management
- Supports multi-tenant operations via sharding capabilities of Azure SQL Database.

## User Roles & Personas

<!-- Describe the types of users who will interact with the application and their primary goals. -->

| Role | Description | Key Actions |
|------|-------------|-------------|
| Patient | Hosptial inpatients during their stay | Send feedback, request concierge, request case manager |
| Concierge | Hospital patient liasons who triage requests and provide assistance and comfort items | Review requests |
| Case Mananger | Hospital care manager responsible for coordinating non-actue aspects patient care, discharge, etc. | Review requests, forward requests to patient record, forward requests to business office |

## Tech Stack

<!-- Preferred languages, frameworks, and libraries for frontend, backend, and data layers. -->

- **Frontend:** JavaScript, with lightweight framework optional.
- **Backend:** Node.js
- **Database:** Azure SQL database, supporting multi-tenant
- **Auth:** Use simple header-based authentication for demo purposes.

## Azure Infrastructure

<!-- Target Azure services and architectural patterns. -->

### Compute & Hosting

Azure App Service, Azure Functions

### Data & Storage

Azure SQL database (for patient/request data), blob storage for application resources

### Identity & Security

All resources shall use managed identities where applicable.
All secrets shall be securely stored in Azure Key Vault, with RBAC-based access.

### Messaging & Integration

Azure APIM for frontend API access, for both the patient-facing app and future integrations.
Scaffold out the "outbound" integration APIs to EMRs, communications systems, etc.; but they can just be call-able via web browser for demonstration purposes.

### Observability

Implement App Insights and Log Analytics Workspaces for all application resources.
All resources should have diagnostic settings enabled and sending to the Log Analytics Workspace as well.

## Environment Strategy

<!-- Describe target environments and deployment approach. -->

- **Environments:** Single "dev" environment, as this is just a PoC
- **IaC Tooling:** Bicep
- **CI/CD:** GitHub Actions

## Constraints & Assumptions

<!-- Any known limitations, compliance requirements, budget considerations, or assumptions. -->

- The solution should use inexpensive resources (e.g., free or low-cost SKUs, Basic/Standard vs Premium where applicable) as this is a demo/POC application.
- Private networking shall be used for any internal communication unless it *significantly* increases costs. If this is the case, call this out and ask for guidance.

## Open Questions

<!-- Capture anything still undecided or needing further discussion. -->

- 
- 
