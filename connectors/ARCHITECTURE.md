# Connectors Module — Architecture

## Overview

The `connectors/` module implements the **plugin system** for third-party integrations. Each connector follows the `Connector<TConfig>` interface defined in `core/connector.ts`.

## Structure

```
connectors/
├── index.ts                    # registerBuiltInConnectors() — registers all built-in connectors
├── _template.connector.ts      # Template for creating new connectors
├── github.connector.ts         # GitHub connector plugin
├── github/
│   ├── index.ts                # Connector definition (metadata, actions, config fields)
│   └── api.ts                  # Pure HTTP client for GitHub REST API
├── atlassian.connector.ts      # Atlassian/Jira connector plugin
├── atlassian/
│   ├── index.ts                # Connector definition
│   └── api.ts                  # Jira REST API client
├── supabase.connector.ts       # Supabase connector plugin
├── supabase/
│   ├── index.ts                # Connector definition
│   └── api.ts                  # Supabase API client
├── digitalocean/
│   ├── index.ts                # DigitalOcean connector definition
│   └── api.ts                  # DigitalOcean API client
└── gmail.connector.ts          # Gmail connector (IMAP + SMTP)
```

## How to Add a New Connector

1. Copy `_template.connector.ts` as `myservice.connector.ts`
2. Create a `myservice/` directory with `index.ts` (definition) and `api.ts` (HTTP client)
3. Implement the `Connector<TConfig>` interface: metadata, configFields, actions, testConnection, executeAction
4. Register it in `connectors/index.ts`

## Key Patterns

- **Separation**: Connector definition (metadata/actions) is separate from API client (pure HTTP)
- **Config fields**: Declarative field definitions drive the UI form automatically
- **Action execution**: Single `executeAction(actionId, config, params)` entry point

## Known Issues & TODOs

1. **Duplicate types** — `atlassian/api.ts` defines types also found in `main/atlassian.ts`; consolidate
2. **No input validation** — `executeAction` casts params unsafely (e.g. `params.owner as string`)
3. **Gmail connector is 267 lines** — IMAP and SMTP logic tightly coupled; consider splitting
4. **No retry logic** — API calls fail on transient errors without retries
5. **Hardcoded GitHub API version** — `X-GitHub-Api-Version: 2022-11-28` should be configurable
