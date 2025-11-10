# Changelog

### 1.0.7

## Breaking Changes

### Default validation Error Path Format

Default validation error paths are now returned as an array including the input location (headers, query, params, body) instead of a dot-separated string.

**Before:**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "path": "user.name",
      "message": "Required"
    }
  ]
}
```

**After:**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "path": ["body", "user", "name"],
      "message": "Required"
    }
  ]
}
```

### 1.0.6

## Bug Fixes

- Fixed potential parsing errors in Express adapter when request properties (headers, query, params, body) are undefined. Now provides empty object fallbacks to ensure validation always receives valid input.


### 1.0.5

## Bug Fixes

- Added some more missing types to the export

### 1.0.4

## Bug Fixes

- Fixed missing TypeScript type exports. Previous versions did not export all required types, which could cause compilation errors when using the library.



### 1.0.3

## Breaking Changes

### Handle Method Now Requires Async Functions

The `handle` method can only be async functions. Synchronous handlers are no longer supported.

**Before:**
```typescript
.handle((req, res) => {
    return { data: 'value' };
})
```

**After:**
```typescript
.handle(async (req, res) => {
    return { data: 'value' };
})
```
