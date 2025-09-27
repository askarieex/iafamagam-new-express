# Monthly Financial Reporting System

## Overview

The Monthly Financial Reporting System provides real-time monthly financial reports with automatic balance calculations. This system generates reports similar to traditional monthly balance sheets while maintaining complete audit trails and handling backdated transactions correctly.

## Key Features

✅ **Real-Time Calculation**: Reports are generated from the immutable transaction log in real-time
✅ **Opening/Closing Balance Management**: Proper balance continuity across months
✅ **Backdated Transaction Support**: Automatic recalculation when historical transactions are added
✅ **Professional Format**: Matches traditional monthly report layouts
✅ **Export Capabilities**: Print and PDF export functionality
✅ **Performance Optimized**: Fast report generation with smart balance caching

## System Architecture

### Database Schema

**monthly_balance_summaries** table:
- Stores monthly opening/closing balance reference points
- Enables efficient report generation
- Supports balance continuity tracking
- Handles backdated transaction recalculation

### Core Components

1. **MonthlyReportService** (`src/services/monthlyReportService.js`)
   - Core business logic for report generation
   - Balance calculation and management
   - Backdated transaction handling

2. **MonthlyReportController** (`src/controllers/monthlyReportController.js`)
   - HTTP request handling
   - API endpoint management
   - Response formatting

3. **Monthly Reports API Routes** (`src/routes/monthlyReportRoutes.js`)
   - RESTful API endpoints
   - Authentication middleware
   - Request validation

4. **Frontend Interface** (`frontend/pages/monthly-reports.js`)
   - User-friendly report generation interface
   - Real-time report display
   - Export and print functionality

## API Endpoints

### Generate Monthly Report
```http
GET /api/reports/monthly/{year}/{month}/{accountId}
```
**Query Parameters:**
- `regenerate`: Force regeneration (true/false)
- `include_transactions`: Include transaction details (true/false)
- `save_results`: Save calculated results (true/false)

**Example:**
```http
GET /api/reports/monthly/2024/4/1?regenerate=false&include_transactions=true
```

### Get Ledger Head Report
```http
GET /api/reports/monthly/{year}/{month}/{accountId}/ledger/{ledgerHeadId}
```

### Get Balance Summary
```http
GET /api/reports/balance-summary/{accountId}
```

### Get Available Months
```http
GET /api/reports/available-months/{accountId}
```

### Finalize Month
```http
POST /api/reports/monthly/{year}/{month}/{accountId}/finalize
```

## Usage Examples

### 1. Generate April 2024 Report
```javascript
// API Call
const response = await axios.get('/api/reports/monthly/2024/4/1');

// Response Format
{
  "success": true,
  "data": {
    "account_id": 1,
    "year": 2024,
    "month": 4,
    "month_name": "April 2024",
    "ledger_heads": [...],
    "totals": {
      "opening_balance": 46651.59,
      "total_credits": 267891.50,
      "total_debits": 144064.00,
      "closing_balance": 170479.09,
      "transaction_count": 156
    },
    "credit_heads": [...],
    "debit_heads": [...]
  }
}
```

### 2. Handle Backdated Transactions
When a backdated transaction is added, the system automatically:
1. Identifies affected months from transaction date to current
2. Recalculates balance summaries for all affected months
3. Updates opening balances for subsequent months
4. Maintains data consistency across the entire timeline

### 3. Balance Calculation Logic

**Opening Balance Calculation:**
```
Opening Balance = Previous Month's Closing Balance
OR
Opening Balance = Sum of all transactions before month start (if no previous data)
```

**Monthly Activity Calculation:**
```
Total Credits = Sum of credit transactions in the month
Total Debits = Sum of debit transactions in the month
```

**Closing Balance Calculation:**
```
Closing Balance = Opening Balance + Total Credits - Total Debits
```

## Report Format

The system generates reports matching the traditional format:

```
FINANCIAL REPORT FOR THE MONTH OF APRIL 2024
GENERAL ACCOUNT

Ledger Head          | O.B    | Recep. During | Amount | Balance
                     |        | the Month     |        |
---------------------|--------|---------------|--------|----------
Donation/Nazar       |   0.00 |    83,233.00 |   0.00 | 83,233.00
Form Fee BB          |   0.00 |        30.00 |   0.00 |     30.00
M.Membership         |   0.00 |     5,310.00 |   0.00 |  5,310.00
...
Total (T1)           |46,651.59|   267,891.50|144,064.00|170,479.09
```

## Key Benefits

### 1. **Data Accuracy**
- Always shows correct numbers based on transaction log
- No risk of outdated snapshots
- Perfect audit trail preservation

### 2. **Flexibility**
- Supports any historical date range
- Handles backdated transactions seamlessly
- Works with immutable transaction system

### 3. **Performance**
- Fast report generation through smart caching
- Optimized balance calculations
- Efficient database queries

### 4. **Professional Reporting**
- Traditional monthly report format
- Print-ready output
- Export capabilities

## Testing Scenarios

### Basic Report Generation
1. Select account, year, and month
2. Click "Generate Report"
3. Verify report displays correctly
4. Check opening/closing balances

### Backdated Transaction Handling
1. Generate report for April 2024
2. Add a March 2024 transaction
3. Regenerate April report
4. Verify opening balance updated correctly

### Balance Continuity
1. Generate reports for consecutive months
2. Verify closing balance of month N = opening balance of month N+1
3. Test with various transaction scenarios

## Error Handling

The system handles various error scenarios:
- Missing ledger heads
- Database connection issues
- Invalid date ranges
- Authentication failures
- Calculation errors

## Security Features

- Authentication required for all endpoints
- Input validation and sanitization
- Audit trail preservation
- Transaction immutability maintained

## Performance Considerations

- Balance summaries are cached for frequently accessed months
- Database indexes optimize query performance
- Pagination support for large datasets
- Background recalculation for backdated transactions

## Future Enhancements

- PDF export functionality
- Email report delivery
- Scheduled report generation
- Advanced filtering options
- Multi-currency support

## Installation & Setup

1. **Database Migration**
   ```bash
   npm run db:migrate
   ```

2. **Start Backend Server**
   ```bash
   npm start
   ```

3. **Access Frontend**
   Navigate to Monthly Reports page in the application

## Troubleshooting

### Common Issues

**"Transaction not found" errors:**
- Ensure transaction log table has data
- Check date ranges and account IDs

**"Opening balance calculation failed":**
- Verify previous month data exists
- Check transaction log integrity

**"Migration failed":**
- Ensure PostgreSQL is running
- Check database permissions

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=monthly-reports npm start
```

## Support

For issues or questions:
1. Check the error logs in console
2. Verify database connectivity
3. Ensure all migrations have run successfully
4. Check API endpoint authentication

---

*This system provides a robust, accurate, and user-friendly solution for monthly financial reporting while maintaining complete data integrity and audit capabilities.*