import {captureError} from '../scripts/lib/capture.mjs';
import {REPO_ROOT} from '../scripts/lib/db.mjs';
import path from 'node:path';
try { throw new Error('Fictional order confirmation timeout'); }
catch(error) { console.log(captureError(error,{directory:path.join(REPO_ROOT,'.data','inbox'),environment:'demo',release:'1.0',fingerprint:'order-confirmation-timeout'})); }
