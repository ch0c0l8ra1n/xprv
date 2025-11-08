# Changelog


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
