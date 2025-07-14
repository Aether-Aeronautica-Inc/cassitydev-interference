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
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Build Info – Aether Inc.</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --primary: #2563eb;
        --light-bg: #f9fafb;
        --card-bg: #ffffff;
        --text: #1e293b;
      }

      body {
        font-family: 'Inter', sans-serif;
        background: var(--light-bg);
        color: var(--text);
        padding: 2rem;
        margin: 0;
      }

      .container {
        max-width: 900px;
        margin: auto;
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 1rem;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05);
        animation: fadeIn 0.4s ease-out;
      }

      h1 {
        font-size: 2rem;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 1rem;
      }

      h2 {
        font-size: 1.25rem;
        color: var(--primary);
        margin-top: 2rem;
        margin-bottom: 0.5rem;
      }

      pre {
        background: #f1f5f9;
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        font-size: 0.95rem;
        line-height: 1.5;
      }

      a {
        display: inline-block;
        margin-top: 2rem;
        text-decoration: none;
        color: var(--primary);
        font-weight: 600;
        transition: color 0.2s ease;
      }

      a:hover {
        color: #1d4ed8;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (max-width: 600px) {
        .container {
          padding: 1.5rem;
        }

        h1 {
          font-size: 1.5rem;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Build Information</h1>
      
      <h2>From package.json</h2>
      <pre>${JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        scripts: pkg.scripts,
        dependencies: pkg.dependencies
      }, null, 2)}</pre>

      <h2>Current Changes</h2>
      <pre>${changes}</pre>

      <a href="/">← Back to Home</a>
    </div>
  </body>
  </html>
  `);
}
