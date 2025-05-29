# IAFA Software - Backend Architecture

## Application Flow Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│             │       │             │       │             │       │             │
│   Client    │──────▶│   Routes    │──────▶│ Controllers │──────▶│   Models    │
│             │       │             │       │             │       │             │
└─────────────┘       └─────────────┘       └─────────────┘       └─────────────┘
                                                                        │
                                                                        ▼
                                                                 ┌─────────────┐
                                                                 │             │
                                                                 │  Database   │
                                                                 │             │
                                                                 └─────────────┘
```

## Routes to Controllers Mapping

### Account Routes
```
/api/accounts/
  GET    / ────────────────┐
  GET    /:id ─────────────┤ Direct database queries in routes/accounts.js
  POST   / ────────────────┤ (No controller abstraction)
  PUT    /:id ─────────────┤
  DELETE /:id ─────────────┘
```

### Ledger Routes 
```
/api/ledgers/
  GET    / ────────────────┐
  GET    /type/:type ──────┤ ledgerController.js methods:
  GET    /:id ─────────────┤ - getAllLedgers
  POST   / ────────────────┤ - getLedgersByType
  PUT    /:id ─────────────┤ - getLedgerById
  DELETE /:id ─────────────┘ - createLedger
                             - updateLedger
                             - deleteLedger
```

## Data Flow Example

For a GET request to `/api/ledgers`:

```
1. Client makes GET request to /api/ledgers
   │
2. routes/ledgers.js routes to ledgerController.getAllLedgers
   │
3. ledgerController.getAllLedgers calls Ledger.getAll()
   │
4. Ledger.getAll() performs SQL query using database pool
   │
5. Results are returned up the chain to the client
```

## Code Organization Pattern

The backend follows a layered architecture pattern:

1. **Routing Layer** (`routes/`)
   - Defines API endpoints
   - Handles HTTP methods
   - Routes to appropriate controller methods

2. **Controller Layer** (`controllers/`)
   - Implements business logic
   - Validates input
   - Calls model methods
   - Formats responses

3. **Model Layer** (`models/`)
   - Represents data entities
   - Handles database operations
   - Implements data validation

4. **Database Layer** (`config/database.js`)
   - Manages database connection
   - Provides query interface

## Inconsistencies in Implementation

There are some inconsistencies in the implementation:

1. **Accounts vs Ledgers**:
   - Account routes handle database operations directly
   - Ledger routes use a controller/model pattern

2. **Error Handling**:
   - Error handling is implemented but could be more consistent
   - Some errors include stack traces in production responses

## Authentication Flow (Not Implemented)

The application currently lacks authentication middleware, which would typically fit in this position:

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│             │       │             │       │             │       │             │
│   Client    │──────▶│ Auth Layer  │──────▶│   Routes    │──────▶│    ...      │
│             │       │             │       │             │       │             │
└─────────────┘       └─────────────┘       └─────────────┘       └─────────────┘
``` 