# IAFA Software - Backend Structure

## Directory Structure

```
backend/
├── src/                      # Source code
│   ├── config/               # Configuration files
│   │   └── database.js       # Database connection setup
│   ├── controllers/          # Logic for handling routes
│   │   └── ledgerController.js  # Ledger CRUD operations
│   ├── middleware/           # Express middleware
│   ├── models/               # Database models
│   │   ├── Ledger.js         # Ledger model with database operations
│   │   ├── db.sql            # Database schema 
│   │   └── setup-db.sql      # Database initialization script
│   ├── routes/               # API route definitions
│   │   ├── accounts.js       # Account routes
│   │   └── ledgers.js        # Ledger routes
│   └── server.js             # Main application entry point
└── package.json              # Project dependencies and scripts
```

## API Endpoints

### Accounts Routes (`/api/accounts`)

| Method | Endpoint          | Description               | Request Body                                  |
|--------|-------------------|---------------------------|----------------------------------------------|
| GET    | /                 | Get all accounts          | -                                            |
| GET    | /:id              | Get account by ID         | -                                            |
| POST   | /                 | Create a new account      | `{name, total_balance, hand_balance, bank_balance}` |
| PUT    | /:id              | Update an account         | `{name, total_balance, hand_balance, bank_balance}` |
| DELETE | /:id              | Delete an account         | -                                            |

### Ledgers Routes (`/api/ledgers`)

| Method | Endpoint          | Description               | Request Body            |
|--------|-------------------|---------------------------|------------------------|
| GET    | /                 | Get all ledgers           | -                      |
| GET    | /type/:type       | Get ledgers by type       | -                      |
| GET    | /:id              | Get ledger by ID          | -                      |
| POST   | /                 | Create a new ledger       | `{name, type}`         |
| PUT    | /:id              | Update a ledger           | `{name, type}`         |
| DELETE | /:id              | Delete a ledger           | -                      |

## Database Schema

### Tables

1. **accounts**
   - id (PK)
   - name 
   - total_balance
   - hand_balance
   - bank_balance
   - created_at
   - updated_at

2. **ledgers**
   - id (PK)
   - name
   - type (debit/credit)
   - created_at
   - updated_at

3. **transactions**
   - id (PK)
   - account_id (FK)
   - ledger_id (FK)
   - amount
   - transaction_type
   - description
   - transaction_date
   - created_at
   - updated_at

4. **cheques**
   - id (PK)
   - account_id (FK)
   - cheque_number
   - amount
   - status
   - issue_date
   - clearing_date
   - description
   - created_at
   - updated_at

## Application Flow

1. The application starts in `server.js`, which sets up Express and loads routes
2. Routes in the `routes/` directory define API endpoints
3. Controllers in the `controllers/` directory handle the business logic
4. Models in the `models/` directory interact with the database
5. Database connection is configured in `config/database.js`

## Authentication & Security

Currently, the API doesn't implement authentication middleware. Routes appear to be publicly accessible.

## How to Extend

To add new functionality:
1. Create a model in `models/` that handles database operations
2. Create a controller in `controllers/` that implements business logic
3. Create a route file in `routes/` to define API endpoints
4. Add the route to `server.js` 