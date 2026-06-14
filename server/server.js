const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/places', require('./routes/places'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/base-products', require('./routes/baseProducts'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = 5000;
app.listen(PORT, () => console.log(`SAS API running at http://localhost:${PORT}`));
