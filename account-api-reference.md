# Accounts API Reference

This document provides details about the accounts API endpoints available in the IAFA Software.

## Base URL
All endpoints are relative to `/api/accounts`.

## Endpoints

### Get All Accounts
Retrieves a list of all accounts.

- **URL**: `/`
- **Method**: `GET`
- **Response**: Array of account objects
- **Example Response**:
  ```json
  [
    {
      "id": 1,
      "name": "General Account",
      "account_type": "general",
      "opening_balance": "183904.39",
      "closing_balance": "183904.39",
      "cash_balance": "13458.00",
      "bank_balance": "170446.40",
      "created_at": "2023-05-20T10:30:00Z",
      "updated_at": "2023-05-20T10:30:00Z"
    },
    {
      "id": 2,
      "name": "Shoba Taleem E Murwaja",
      "account_type": "stm",
      "opening_balance": "314503.00",
      "closing_balance": "314503.00",
      "cash_balance": "1500.00",
      "bank_balance": "313003.00",
      "created_at": "2023-05-20T10:30:00Z",
      "updated_at": "2023-05-20T10:30:00Z"
    }
  ]
  ```

### Get Account by ID
Retrieves a specific account by its ID.

- **URL**: `/id/:id`
- **Method**: `GET`
- **Parameters**: `id` - Account ID
- **Response**: Account object
- **Example Response**:
  ```json
  {
    "id": 1,
    "name": "General Account",
    "account_type": "general",
    "opening_balance": "183904.39",
    "closing_balance": "183904.39",
    "cash_balance": "13458.00",
    "bank_balance": "170446.40",
    "created_at": "2023-05-20T10:30:00Z",
    "updated_at": "2023-05-20T10:30:00Z"
  }
  ```

### Get Account by Name
Retrieves a specific account by its name.

- **URL**: `/name/:name`
- **Method**: `GET`
- **Parameters**: `name` - Account name (URL encoded)
- **Response**: Account object
- **Example**: `/api/accounts/name/General%20Account`

### Get Accounts by Type
Retrieves accounts filtered by type.

- **URL**: `/type/:type`
- **Method**: `GET`
- **Parameters**: `type` - Account type (one of: 'general', 'stm', 'trust', 'imdad')
- **Response**: Array of account objects
- **Example**: `/api/accounts/type/general`

### Create Account
Creates a new account.

- **URL**: `/`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "name": "New Account",
    "account_type": "general",
    "opening_balance": 10000.00,
    "cash_balance": 5000.00,
    "bank_balance": 5000.00
  }
  ```
- **Response**: Created account object

### Update Account
Updates an existing account.

- **URL**: `/:id`
- **Method**: `PUT`
- **Parameters**: `id` - Account ID
- **Request Body**:
  ```json
  {
    "name": "Updated Account Name",
    "account_type": "general",
    "closing_balance": 15000.00,
    "cash_balance": 7000.00,
    "bank_balance": 8000.00
  }
  ```
- **Response**: Updated account object

### Update Account Balances
Updates only the balances of an account.

- **URL**: `/:id/balances`
- **Method**: `PATCH`
- **Parameters**: `id` - Account ID
- **Request Body**:
  ```json
  {
    "closing_balance": 12000.00,
    "cash_balance": 5000.00,
    "bank_balance": 7000.00
  }
  ```
- **Response**: Updated account object

### Delete Account
Deletes an account.

- **URL**: `/:id`
- **Method**: `DELETE`
- **Parameters**: `id` - Account ID
- **Response**:
  ```json
  {
    "message": "Account deleted successfully",
    "deletedAccount": {
      "id": 5,
      "name": "Account to Delete",
      "account_type": "general",
      "opening_balance": "10000.00",
      "closing_balance": "10000.00",
      "cash_balance": "5000.00",
      "bank_balance": "5000.00",
      "created_at": "2023-05-20T10:30:00Z",
      "updated_at": "2023-05-20T10:30:00Z"
    }
  }
  ```

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

- **400 Bad Request**: For validation errors or missing fields
- **404 Not Found**: When a requested resource doesn't exist
- **500 Server Error**: For internal server errors

### Example Error Response:
```json
{
  "error": "Account not found"
}
```

or

```json
{
  "error": "Failed to update account",
  "message": "Error details..."
}
``` 