# Monthly Snapshot Backfill Scripts

This directory contains scripts and utilities for managing monthly balance snapshots in the IAFA accounting system.

## Overview

The snapshot system is designed to preserve historical balance data for accurate financial reporting across different time periods. This is particularly important for:

- **Historical Reports**: Viewing financial statements for past months with accurate month-end balances
- **Performance Tracking**: Comparing financial performance across different periods
- **Audit Trail**: Maintaining a complete record of financial positions at specific points in time

## Backfill Script Usage

### Command Line Usage

The backfill script can be run from the backend directory:

```bash
# Navigate to backend directory
cd backend

# Backfill all accounts for a date range
node scripts/backfillSnapshots.js all <startYear> <startMonth> <endYear> <endMonth>

# Backfill specific account for a date range
node scripts/backfillSnapshots.js <accountId> <startYear> <startMonth> <endYear> <endMonth>
```

### Examples

```bash
# Generate snapshots for all accounts from January 2023 to December 2024
node scripts/backfillSnapshots.js all 2023 1 2024 12

# Generate snapshots for account ID 25 from January to August 2024
node scripts/backfillSnapshots.js 25 2024 1 2024 8

# Generate snapshots for account ID 1 for the year 2023
node scripts/backfillSnapshots.js 1 2023 1 2023 12
```

### API Endpoints

You can also trigger backfill operations via the REST API:

#### Backfill Specific Account

```http
POST /api/reports/backfill-snapshots/:accountId
Content-Type: application/json

{
  "startYear": 2023,
  "startMonth": 1,
  "endYear": 2024,
  "endMonth": 12
}
```

#### Backfill All Accounts

```http
POST /api/reports/backfill-all-accounts
Content-Type: application/json

{
  "startYear": 2023,
  "startMonth": 1,
  "endYear": 2024,
  "endMonth": 12
}
```

## How It Works

1. **Month Iteration**: The script iterates through each month in the specified date range
2. **Existing Check**: For each month, it checks if snapshots already exist
3. **Skip or Generate**: If snapshots exist, it skips; otherwise, it generates new snapshots
4. **Progress Tracking**: The script provides detailed progress information and statistics

## Output Example

```
🚀 Monthly Snapshot Backfill Script
=====================================

🔄 Starting snapshot backfill for account 25
📅 Date range: 2024-1 to 2024-8

📊 Processing 2024-01
   🔄 Generating snapshots...
   ✅ Snapshots generated successfully

📊 Processing 2024-02
   ⚠️  Snapshots already exist (15 records), skipping

📊 Processing 2024-03
   🔄 Generating snapshots...
   ✅ Snapshots generated successfully

📊 Backfill Summary:
   Total months processed: 8
   Snapshots generated: 6
   Months skipped (already had snapshots): 2
✅ Backfill completed for account 25
```

## Important Notes

### Data Safety
- **Non-destructive**: The script never overwrites existing snapshots
- **Idempotent**: Running the script multiple times with the same parameters is safe
- **Validation**: All inputs are validated before processing

### Performance Considerations
- **Large Date Ranges**: Backfilling many months across multiple accounts can take time
- **Database Load**: The script performs intensive calculations, so run during low-traffic periods
- **Memory Usage**: Processing multiple accounts simultaneously may require adequate system resources

### Best Practices

1. **Start Small**: Test with a single account and short date range first
2. **Recent First**: Consider backfilling recent months first for immediate benefit
3. **Monitor Progress**: The script provides detailed logging to track progress
4. **Verify Results**: Check a few generated reports to ensure accuracy

## Troubleshooting

### Common Issues

1. **Missing Dependencies**: Ensure all Node.js dependencies are installed
2. **Database Connection**: Verify database connection and permissions
3. **Invalid Dates**: Check that year and month values are valid
4. **Account IDs**: Ensure specified account IDs exist in the database

### Error Messages

- `❌ Missing required arguments`: Check command line arguments
- `❌ Invalid year or month values`: Ensure numeric values for dates
- `❌ Month values must be between 1 and 12`: Check month range
- `❌ Invalid account ID`: Verify account exists in database

## Integration with Frontend

The backfill functionality is also accessible through the web interface:

1. Navigate to Monthly Reports page
2. Select a historical month (not current month)
3. Use the "Update Snapshots" button to regenerate specific month snapshots
4. Admin users can access bulk backfill operations

## Technical Implementation

The backfill system leverages:

- **MonthlySnapshotService**: Core service for snapshot generation
- **Transaction Log System**: Immutable transaction records for historical accuracy
- **Balance Calculation Engine**: Precise balance calculations as of specific dates
- **Database Transactions**: Ensures data consistency during snapshot creation

## Future Enhancements

Potential improvements include:

- **Parallel Processing**: Multi-threaded backfill for better performance
- **Resume Capability**: Ability to resume interrupted backfill operations
- **Incremental Updates**: Smart detection of which snapshots need regeneration
- **Scheduling**: Automated snapshot generation for previous months