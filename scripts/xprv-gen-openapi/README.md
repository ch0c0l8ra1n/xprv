# xprv-gen-openapi

Generates OpenAPI 3.1 specifications from XPRV TypeScript applications.

## Architecture

The generator is organized into focused modules:

### Core Modules

**`index.ts`** (142 lines) - Main entry point
- Orchestrates the entire generation process
- Loads TypeScript project and extracts XPRV types
- Coordinates between all other modules
- Clean, high-level flow that's easy to understand

**`schema-generator.ts`** (254 lines) - TypeScript to JSON Schema conversion
- Leverages `ts-json-schema-generator` for named types
- Custom handling for primitives, special types, and built-in types
- Manages component schemas for reusability

**`route-traversal.ts`** (266 lines) - Route tree processing
- Extracts routes from XPRV route nodes
- Processes request/response types
- Builds operation representations

**`openapi-builder.ts`** (147 lines) - OpenAPI document construction
- Builds OpenAPI paths and operations
- Merges responses with proper schema handling
- Manages response deduplication

### Utility Modules

**`cli.ts`** (36 lines) - Command-line argument parsing
- Handles `--tsconfig` flag
- Validates required arguments

**`utils.ts`** (56 lines) - Helper functions
- Path utilities (`joinPaths`, `findTsConfig`)
- Type utilities (`getLiteralString`, `cleanSymbolName`)
- Operation ID generation

**`type-utils.ts`** (44 lines) - TypeScript type helpers
- Type splitting and analysis
- Request validation detection

**`types.ts`** (45 lines) - Type definitions
- Shared interfaces across modules
- No implementation, just contracts

## Module Organization

```
xprv-gen-openapi/
├── index.ts              # Main orchestrator (entry point)
├── cli.ts                # Argument parsing
├── schema-generator.ts   # TS → JSON Schema conversion
├── route-traversal.ts    # Route tree processing
├── openapi-builder.ts    # OpenAPI document building
├── utils.ts              # General utilities
├── type-utils.ts         # TypeScript type utilities
└── types.ts              # Shared type definitions
```

## Benefits of Modular Design

1. **Separation of Concerns**: Each module has a single, clear responsibility
2. **Testability**: Individual modules can be tested in isolation
3. **Maintainability**: Changes to one aspect don't affect others
4. **Readability**: `index.ts` reads like high-level pseudocode
5. **Reusability**: Modules can be used independently if needed

## Usage

```bash
# Basic usage
xprv-gen-openapi src/server.ts myApp

# With custom output path
xprv-gen-openapi src/server.ts myApp openapi.json

# With explicit tsconfig
xprv-gen-openapi src/server.ts myApp --tsconfig tsconfig.build.json
```

## Dependencies

- **ts-morph**: TypeScript compiler API wrapper
- **ts-json-schema-generator**: TypeScript to JSON Schema conversion

## Lines of Code

Total: **990 lines** across 8 focused modules

### Comparison with Monolithic Design

| Metric | Before | After |
|--------|--------|-------|
| Total Lines | 1,054 | 990 |
| Files | 1 | 8 |
| Largest File | 1,054 lines | 266 lines |
| Average File Size | 1,054 lines | 124 lines |
| Concerns Separated | ❌ | ✅ |

The modular design is **6% smaller** and infinitely more maintainable!

