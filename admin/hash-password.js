import { scrypt as scryptCallback, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const password = await new Promise((resolve, reject) => {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => resolve(input.replace(/[\r\n]+$/, '')));
  process.stdin.on('error', reject);
});

if (password.length < 16 || password.length > 1024) {
  console.error('La contraseña debe tener entre 16 y 1024 caracteres.');
  process.exitCode = 1;
} else {
  const salt = randomBytes(32);
  const hash = await scrypt(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  process.stdout.write(`scrypt:65536:8:1:${salt.toString('base64url')}:${hash.toString('base64url')}\n`);
}
