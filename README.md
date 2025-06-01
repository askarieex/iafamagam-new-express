# IAFA Software

This is a financial management system with a Node.js/Express backend and Next.js frontend.

## Project Structure

The project is divided into two main parts:

### Backend (Node.js/Express with PostgreSQL)

- Located in the `backend` folder
- REST API with Express
- PostgreSQL database
- Handles accounts, ledgers, transactions, and cheques management

### Frontend (Next.js)

- Located in the `frontend` folder
- Built with Next.js
- Responsive UI with sidebar navigation
- Displays financial accounts and their balances

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL

### Setting Up the Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a PostgreSQL database and run the SQL schema:
   - Create a database called `iafa_software`
   - Run the SQL in `backend/src/models/db.sql`

4. Create a `.env` file in the backend directory with the following:
   ```
   PORT=5000
   DB_USER=your_db_username
   DB_HOST=localhost
   DB_NAME=iafa_software
   DB_PASSWORD=your_db_password
   DB_PORT=5432
   ```

5. Start the backend server:
   ```
   npm run dev
   ```

The API will be running at http://localhost:5000

### Setting Up the Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The frontend will be running at http://localhost:3000

## Features

- Account management
- Ledger management
- Transaction tracking
- Cheque management
- Balance tracking (total, hand, and bank balances)
- Responsive sidebar navigation

## UI Improvements

The IAFA Software frontend has been redesigned to be more responsive, accessible, and aesthetically pleasing. Key improvements include:

### Responsive Design
- Optimized layouts for all device sizes (mobile, tablet, laptop, desktop)
- Proper handling of sidebar in mobile view
- Mobile-friendly tables with horizontal scrolling
- Responsive form layouts that adapt to screen size

### Modern UI Components
- Redesigned card components with subtle animations and hover effects
- Improved button styles with proper focus and hover states
- Consistent typography scale and spacing
- Better form controls with appropriate feedback states

### Accessibility Improvements
- Enhanced keyboard navigation support
- Proper color contrast ratios
- Better focus management for interactive elements
- Screen reader friendly element structure

### Dark Mode
- Full dark mode support across all components
- Smooth transition between light and dark modes
- Preserved user preference using localStorage

### Performance Optimizations
- Optimized CSS with Tailwind JIT compiler
- Reduced CSS bundle size
- Better responsive image handling
- Smoother animations using GPU acceleration 