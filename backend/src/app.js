// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
// ... other route imports ...

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// ... other route uses ... 