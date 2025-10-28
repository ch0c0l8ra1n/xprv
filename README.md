# XPRV

> Type-safe, expressive REST API framework for TypeScript

XPRV (expressive) is a TypeScript-first framework for building type-safe REST APIs. Heavily inspired by tRPC, XPRV brings end-to-end type safety while following HTTP semantics and RESTful principles. Built on Express.js, it provides full type safety from server to client, automatic request validation with Zod, and can generate OpenAPI 3.1 specifications for non-TypeScript consumers.

## Features

**Full Type Safety** - End-to-end type safety from server to client, including all error responses (404, 405, 400 validation errors, 500 internal errors)

**tRPC-Inspired DX** - Get the developer experience of tRPC with the flexibility of RESTful HTTP semantics

**Automatic OpenAPI Generation** - Generate OpenAPI 3.1 specs from TypeScript types for non-TypeScript clients

**Request Validation** - Built-in Zod validation for headers, params, query, and body with automatic error handling

**Type-Safe Client** - Fully typed client SDK with autocomplete for routes, methods, and responses

**Hierarchical Routes** - Organize routes in a tree structure for better code organization

**Express Underneath** - Full access to Express.js objects via `withContextProvider` when you need them

**Zero Runtime Overhead** - Type information is compile-time only

**Excellent DX** - Superior IDE autocomplete and compile-time error checking

## Installation

```bash
npm install xprv
```

This automatically installs `express` and `zod` as dependencies.

## Quick Start

### 1. Create a Server

```typescript
import xprv from "xprv";
import express from "express";
import z from "zod";

// Define a route node
const pingNode = xprv.node({
  path: "/ping",
  handlers: {
    get: xprv.handler.handle(() => {
      return xprv.json({
        status: 200,
        body: { message: "pong!" },
        headers: { "X-Custom": "value" },
      });
    }),
  },
});

// Create a validated route
const calculatorNode = xprv.node({
  path: "/calculator",
  handlers: {
    post: xprv.handler
      .withInput({
        body: z.object({
          a: z.number(),
          b: z.number(),
          operation: z.enum(["add", "subtract", "multiply", "divide"]),
        }),
      })
      .handle((input) => {
        const { a, b, operation } = input.body;
        let result: number;
        
        switch (operation) {
          case "add": result = a + b; break;
          case "subtract": result = a - b; break;
          case "multiply": result = a * b; break;
          case "divide": 
            if (b === 0) {
              return xprv.json({
                status: 400,
                body: { error: "Division by zero" },
              });
            }
            result = a / b;
            break;
        }
        
        return xprv.json({
          status: 200,
          body: { result },
        });
      }),
  },
});

// Build route tree
const rootNode = xprv.node({
  path: "/",
  children: [pingNode, calculatorNode],
});

// Create app
export const xprvApp = xprv.app({
  rootNode,
  errorHandlers: {
    onInternalServerError: (error, req, res) => {
      return xprv.json({
        status: 500,
        body: { message: "Internal server error" },
      });
    },
  },
});

export type xprvAppType = typeof xprvApp;

// Use with Express
const app = express();
app.use(xprvApp.buildRouter());
app.listen(3000, () => console.log("Server running on port 3000"));
```

### 2. Create a Type-Safe TypeScript Client

For TypeScript clients, you get full type safety without any code generation:

```typescript
import xprv from "xprv";
import { xprvAppType } from "./server";

const client = new xprv.Client<xprvAppType>({
  baseUrl: "http://localhost:3000",
  fetchMethod: fetch,
});

// Fully typed request and response!
const response = await client.post("/calculator", {
  body: {
    a: 10,
    b: 20,
    operation: "add", // Type-checked!
  },
});

if (response.status === 200) {
  console.log(response.body.result); // Type: number
} else if (response.status === 400) {
  console.log(response.body.error); // Type: string
}
```

### 3. OpenAPI Generation (For Non-TypeScript Clients)

If you need to support non-TypeScript clients (like mobile apps, other languages), generate an OpenAPI specification:

```bash
npx xprv-gen-openapi src/server.ts xprvApp
```

This generates `xprvApp.openapi.json` with a complete OpenAPI 3.1 specification that can be used with any OpenAPI tooling.

## API Reference

### `xprv.node(config)`

Creates a route node in the route tree.

```typescript
xprv.node({
  path: string,           // Route path (supports Express path params like ":id")
  handlers?: {            // HTTP method handlers
    get?: RouteHandler,
    post?: RouteHandler,
    put?: RouteHandler,
    patch?: RouteHandler,
    delete?: RouteHandler,
  },
  children?: RouteNode[], // Child route nodes
})
```

### `xprv.handler`

Creates a route handler with optional input validation.

```typescript
// Without validation
xprv.handler.handle((input, context) => {
  return xprv.json({ status: 200, body: { /* ... */ } });
});

// With validation
xprv.handler
  .withInput({
    headers?: ZodSchema,
    params?: ZodSchema,
    query?: ZodSchema,
    body?: ZodSchema,
  })
  .handle(({ body }) => {
    // body is fully typed based on Zod schema!
    return xprv.json({ status: 200, body: { /* ... */ } });
  });
```

### `xprv.json(response)`

Creates a typed JSON response.

```typescript
xprv.json({
  status: number,         // HTTP status code
  body: object,          // Response body (will be JSON.stringified)
  headers?: object,      // Optional response headers
})
```

### `xprv.app(config)`

Creates an XPRV application instance.

```typescript
xprv.app({
  rootNode: RouteNode,
  errorHandlers?: {
    onInternalServerError?: ErrorHandler,
    onNotFound?: ErrorHandler,
    onMethodNotAllowed?: ErrorHandler,
    onValidationError?: ValidationErrorHandler,
  },
})
```

### `xprv.Client<AppType>(config)`

Creates a type-safe client for your API.

```typescript
new xprv.Client<typeof myApp>({
  baseUrl: string,
  fetchMethod: typeof fetch,
  defaultHeaders?: Record<string, string>,
})
```

## CLI Tools

### `xprv-gen-openapi`

Generates OpenAPI 3.1 specifications from your XPRV application for non-TypeScript clients.

```bash
xprv-gen-openapi <source-file> <variable-name> [output-path] [--tsconfig <path>]
```

**Examples:**
```bash
# Basic usage
xprv-gen-openapi src/server.ts myApp

# Custom output path
xprv-gen-openapi src/server.ts myApp ./docs/openapi.json

# With custom tsconfig
xprv-gen-openapi src/server.ts myApp --tsconfig tsconfig.build.json
```

**Features:**
- Generates complete OpenAPI 3.1 specification
- Extracts types from TypeScript (interfaces, enums, unions, etc.)
- Includes request/response schemas, parameters, and headers
- Supports Zod validation schemas
- Automatic component reuse and `$ref` generation

### `xprv-extract-type` (Work in Progress)

A utility for extracting TypeScript types from your XPRV application. This will enable type sharing between server and clients without requiring a monorepo setup.

## Type Safety

XPRV provides comprehensive type safety across your entire API, including all error responses:

### Fully Typed Errors

Every possible response is typed, including:
- **404 Not Found** - Typed error responses for missing routes
- **405 Method Not Allowed** - Typed error responses for unsupported methods
- **400 Validation Errors** - Typed validation error responses with detailed error information
- **500 Internal Server Errors** - Typed error responses for server errors
- **Custom Error Responses** - Any custom error responses you define

### Server-Side Type Safety

```typescript
const handler = xprv.handler
  .withInput({
    body: z.object({
      name: z.string(),
      age: z.number(),
    }),
  })
  .handle(({ body }) => {
    // body.name is string
    // body.age is number
    // body.invalid - TypeScript error!
    
    return xprv.json({
      status: 200,
      body: { message: `Hello ${body.name}` },
    });
  });
```

### Client-Side Type Safety

```typescript
// Knows all available routes
await client.get("/ping");

// Enforces correct request body
await client.post("/users", {
  body: { name: "John", age: 30 } // Typed!
});

// TypeScript error - invalid operation
await client.post("/calculator", {
  body: { operation: "invalid" }
});

// All response types are inferred, including errors
const response = await client.get("/users/123");
if (response.status === 200) {
  console.log(response.body.user.name); // Fully typed!
} else if (response.status === 404) {
  console.log(response.body.error); // Typed 404 error!
} else if (response.status === 500) {
  console.log(response.body.message); // Typed 500 error!
}
```

## Advanced Usage

### Accessing Express Objects

XPRV is built on Express.js. When you need access to the underlying Express request/response objects, use `withContextProvider`:

```typescript
const handler = xprv.handler
  .withContextProvider((req, res) => ({
    // Access Express req and res objects
    ip: req.ip,
    userAgent: req.get('user-agent'),
    // Provide any custom context
    userId: req.user?.id,
  }))
  .handle((input, context) => {
    // context has the return value from withContextProvider
    console.log(context.ip, context.userAgent, context.userId);
    
    return xprv.json({
      status: 200,
      body: { message: "Hello!" },
    });
  });
```

### Nested Routes

```typescript
const usersNode = xprv.node({
  path: "/users",
  children: [
    xprv.node({
      path: "/:id",
      handlers: {
        get: xprv.handler.handle(({ params }) => {
          // Access route params
          const userId = params.id;
          return xprv.json({ status: 200, body: { userId } });
        }),
      },
    }),
  ],
});
```

### Custom Error Handlers

```typescript
const app = xprv.app({
  rootNode,
  errorHandlers: {
    onValidationError: (error, req, res) => {
      return xprv.json({
        status: 400,
        body: {
          error: "Validation failed",
          details: error.details,
        },
      });
    },
    onNotFound: (req, res) => {
      return xprv.json({
        status: 404,
        body: { error: "Route not found" },
      });
    },
  },
});
```

### Integration with Express Middleware

```typescript
const app = express();

// Use standard Express middleware
app.use(express.json());
app.use(cors());

// Add XPRV routes
app.use(xprvApp.buildRouter());

// Add other Express routes
app.get("/health", (req, res) => res.send("OK"));
```

## Project Structure

```
xprv/
├── src/
│   ├── core/              # Core framework code
│   ├── client/            # Type-safe client
│   └── index.ts           # Main export
├── scripts/
│   ├── xprv-gen-openapi/  # OpenAPI generator CLI
│   └── xprv-extract-type/ # Type extractor CLI
└── example/               # Example application
```

## Examples

See the [`example/`](./example) directory for a complete working example with:
- Server implementation
- Client implementation
- OpenAPI generation
- Type-safe API calls

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

rajatparajuli5@gmail.com

