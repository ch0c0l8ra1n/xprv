# xprv-extract-type

Extracts and displays TypeScript type information for a variable using ts-morph.

## Architecture

The type extractor is organized into focused modules:

### Core Modules

**`index.ts`** (43 lines) - Main entry point
- Orchestrates the type extraction process
- Coordinates CLI parsing, tsconfig resolution, and type extraction
- Clean, high-level flow

**`type-extractor.ts`** (42 lines) - Type extraction logic
- Uses ts-morph to load TypeScript project
- Extracts type information from variables
- Returns structured type data

**`formatter.ts`** (62 lines) - Type formatting and display
- Formats type information for human-readable output
- Displays type text, symbol names, type arguments, and properties
- Pretty-prints to console

### Utility Modules

**`cli.ts`** (32 lines) - Command-line argument parsing
- Handles `--tsconfig` flag
- Validates required arguments

**`utils.ts`** (25 lines) - Helper functions
- Recursive tsconfig.json discovery

**`types.ts`** (5 lines) - Type definitions
- Shared interfaces

## Module Organization

```
xprv-extract-type/
├── index.ts           # Main orchestrator (entry point)
├── cli.ts             # Argument parsing
├── type-extractor.ts  # TypeScript type extraction
├── formatter.ts       # Type formatting and display
├── utils.ts           # Utilities
└── types.ts           # Shared type definitions
```

## Usage

```bash
# Basic usage
xprv-extract-type src/server.ts myVariable

# With explicit tsconfig
xprv-extract-type src/server.ts myVariable --tsconfig tsconfig.build.json
```

## Output Format

The script displays:
- Variable name
- Symbol name (if available)
- Full type text
- Type arguments (for generic types)
- Object properties (first 10, for object types)

## Example

```bash
$ xprv-extract-type example/src/server.ts xprvApp

=== Type Information ===

Variable: xprvApp
Symbol Name: XPRVApp

Type:
XPRVApp<JsonRouteNode<"/", {...}, [...]>, ...>

Type Arguments (5):
  [0]: JsonRouteNode<"/", {...}, [...]>
  [1]: JsonResponse<500, {...}, unknown>
  [2]: JsonResponse<404, {...}, unknown>
  [3]: JsonResponse<405, {...}, unknown>
  [4]: JsonResponse<400, {...}, unknown>

========================
```

## Dependencies

- **ts-morph**: TypeScript compiler API wrapper

## Lines of Code

Total: **209 lines** across 6 focused modules

