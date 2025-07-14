import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildHandler(req, res) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  let changes = 'No current changes found.';

  try {
    changes = fs.readFileSync(path.join(__dirname, '..', 'docs/current_changes.md'), 'utf8');
  } catch (err) {
    console.error('Failed to read current_changes.md:', err.message);
  }

  res.send(`
  <html>
  <head>
    <title>Build Info – Aether Inc.</title>
    <style>
      body { font-family: 'Inter', sans-serif; background: #f9fafb; padding: 2rem; color: #1e293b; }
      pre { background: #fff; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; }
      h1, h2 { color: #2563eb; }
      a { color: #2563eb; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>Build Information</h1>
    <h2>From package.json</h2>
    <pre>${JSON.stringify({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      scripts: pkg.scripts,
      dependencies: pkg.dependencies
    }, null, 2)}</pre>

    <h2>Current Changes (docs/current_changes.md)</h2>
    <pre>${changes}</pre>

    <p><a href="/">← Back to Home</a></p>
  </body>
  </html>
  `);
}
