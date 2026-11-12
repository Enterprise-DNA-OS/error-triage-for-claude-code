import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
// Explicit local capture, never a network send. Call in the application's catch path.
export function captureError(error,{directory,environment,release,fingerprint}={}) {
 if(!(error instanceof Error))throw Error('captureError requires an Error');
 if(!directory||!environment||!release)throw Error('directory, environment and release are required');
 const payload={data:{uuid:randomUUID(),timestamp:Date.now()/1000,environment,code_version:release,level:'error',
  ...(fingerprint?{fingerprint}:{}),body:{trace:{exception:{class:error.name,message:error.message},frames:[]}}}};
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,payload.data.uuid+'.json');
 fs.writeFileSync(file,JSON.stringify(payload),{flag:'wx',mode:0o600});
 return file;
}
