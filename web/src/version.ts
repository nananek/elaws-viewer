// Replaced at build time by vite `define`. In dev (vite serve) the literal
// __APP_VERSION__ stays as the placeholder string, so we coerce to "dev".
declare const __APP_VERSION__: string;

const raw = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const APP_VERSION: string = raw || 'dev';
