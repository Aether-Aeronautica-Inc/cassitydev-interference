import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, loginHandler } from '../pages/auth.js';
import { buildHandler } from '../pages/build.js';

import { createBot } from './bot-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'aether-inc-secret',
  resave: false,
  saveUninitialized: false
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'home.html'));
});

app.get('/keep-alive', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'keep-alive.html'))
})

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'login.html'));
});

app.post('/login', loginHandler);

app.get('/build', authMiddleware, buildHandler);

app.listen(process.env.PORT || 2000);