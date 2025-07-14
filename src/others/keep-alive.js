import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('AI Employee System is alive'));
app.listen(process.env.PORT || 3000);
