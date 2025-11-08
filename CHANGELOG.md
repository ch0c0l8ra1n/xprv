# Changelog

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

