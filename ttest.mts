console.log('__dirname:', typeof __dirname, __dirname);
console.log('import.meta.url:', import.meta.url);
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
console.log('resolved:', dirname(fileURLToPath(import.meta.url)));