const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { ensureQueue } = require('./services/queueService');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message,
      details: err.stack
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log('Ready for Frontend requests...');
  ensureQueue();
});
