import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * App version computed once at server startup. Matches the value injected
 * into the web bundle at build time (vite `define`); see web/vite.config.ts.
 *
 * Sources, in order:
 *   1. $APP_VERSION (CI / docker run -e APP_VERSION=… passes a tag or SHA)
 *   2. git short SHA of HEAD
 *   3. literal "dev"
 */
function compute(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const cwd = resolve(import.meta.dirname, '..', '..');
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'dev';
  }
}

export const APP_VERSION: string = compute();
