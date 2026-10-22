// `nginx -t` for the two http-level snippets this repo ships. Neither is a complete config - each
// is dropped into somebody else's http{} - so the check writes the wrapper around them and
// validates that. Without this, the deploy configs are only ever parsed by the front proxy, which
// is not somewhere a mistake can be reviewed.
//
//   node tools/check-nginx.mjs
//
// What it touches, and why: deploy/proxy-showcase.conf includes the header list by its deployed
// absolute path, so the check installs it there (the deployment does the same). And the vhost
// proxies to `upstream showcase_backend`, which the front proxy owns - see the comment in that
// file - so a stub on an unreachable port is supplied for the syntax check. That stub is a
// convenience of THIS check, not a claim that the vhost is self-contained: nothing here connects.
//
// If nginx is not installed the check says so and counts itself as skipped. It does not quietly
// pass: a guard that pretends to have run is the bug this repo spent 2025 chasing elsewhere.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const probe = spawnSync('nginx', ['-v']);      // -v writes to stderr and exits 0 when present
if (probe.error || probe.status !== 0) {
  console.log('SKIP  nginx not installed - the config guard did NOT run');
  console.log('0 configs checked, 2 skipped');
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'nginx-check-'));
let stubLine = '';
const stub = (line) => { stubLine = `  ${line}\n`; };
const HEADERS_AT = '/etc/nginx/showcase/proxy-headers.conf';
let checked = 0, failed = 0;

// Both files are http-level (they contain `map` blocks and `server` blocks), so the wrapper is
// events{} + http{}. `error_log` and `pid` go to the temp dir: nginx would otherwise write to
// /var/log and refuse on a machine where this runs unprivileged.
function check(name, file, before = null) {
  // nginx binds its listeners during a config test. The container's server listens on a unix
  // socket that only exists once the quadlet volume is mounted, so the check swaps that one line
  // for a loopback port. What it therefore cannot catch is a typo in the socket path - everything
  // else in the block is tested as written.
  let source = file;
  if (before) {
    const [from, to] = before;
    if (!readFileSync(file, 'utf8').includes(from)) { console.log(`  FAIL  ${name}: expected to find "${from}" to substitute for the test`); failed++; return; }
    source = join(dir, name.replace(/[^\w.-]/g, '_') + '.snippet.conf');
    writeFileSync(source, readFileSync(file, 'utf8').replace(from, to));
  }
  const conf = join(dir, name.replace(/[^\w.-]/g, '_') + '.conf');
  writeFileSync(conf, `pid ${dir}/nginx.pid;\nerror_log ${dir}/error.log;\nevents { worker_connections 16; }\nhttp {\n${stubLine}  include ${source};\n}\n`);
  const r = spawnSync('nginx', ['-t', '-c', conf], { encoding: 'utf8' });
  const detail = (r.stderr || r.stdout || '').split('\n').filter((l) => /emerg|\[error\]|successful/.test(l)).join('\n   ');
  if (r.status === 0) { checked++; console.log(`  ok    ${name}`); }
  else { checked++; failed++; console.log(`  FAIL  ${name}\n   ${detail}`); }
}

try { mkdirSync('/etc/nginx/showcase', { recursive: true }); copyFileSync('deploy/proxy-headers.conf', HEADERS_AT); }
catch (e) { console.log(`  note  could not install ${HEADERS_AT} (${e.code}) - the vhost include will fail as a result`); }

// The upstream the vhost proxies to belongs to the front proxy; port 1 is a placeholder here for
// the same reason the socket is: the syntax check must not have to reach anything.
stub('upstream showcase_backend { server 127.0.0.1:1; }');
check('nginx.conf', resolve('nginx.conf'), ['listen unix:/socket/nginx.sock;', 'listen 127.0.0.1:1;']);
check('deploy/proxy-showcase.conf', resolve('deploy/proxy-showcase.conf'));

console.log(`${checked} configs checked, ${failed} failure(s)`);
process.exit(failed ? 1 : 0);
