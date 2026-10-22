// `nginx -t` for the two http-level snippets this repo ships. Neither is a complete config - each
// is dropped into somebody else's http{} - so the check writes the wrapper around them and
// validates that. Without this, the deploy configs are only ever parsed by the front proxy, which
// is not somewhere a mistake can be reviewed.
//
//   node tools/check-nginx.mjs
//
// Three substitutions, each forced by what `nginx -t` does while testing, and each one a line the
// check reports rather than a file it rewrites: the container's unix socket (a config test BINDS
// listeners, and that socket exists only once the quadlet volume is mounted), the `upstream
// showcase_backend` the front proxy owns (a test resolves names, and nothing here may connect),
// and the header list included by its deployed absolute path - validating /etc/nginx/... would
// mean installing first, and a failed install leaves a STALE copy sitting there that passes while
// the repo's own file is broken. Measured, hence this. Everything else, proxy-headers.conf
// included, is parsed as committed.
//
// If nginx is not installed the check says so and counts itself as skipped. It does not quietly
// pass: a guard that pretends to have run is the bug this repo spent 2025 chasing elsewhere.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const probe = spawnSync('nginx', ['-v']);      // -v writes to stderr and exits 0 when present
if (probe.error || probe.status !== 0) {
  // Non-zero on purpose: `node build.mjs && node tools/check-nginx.mjs` must not go green on a
  // machine where the guard never ran. A guard that skips in silence is the bug this repo spent a
  // month chasing in its other tools.
  console.log('FAIL  nginx not installed - the config guard did not run at all');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'nginx-check-'));
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* already printed */ } });
let stubLine = '';
const stub = (line) => { stubLine = `  ${line}\n`; };
let checked = 0, failed = 0;

// Both files are http-level (they contain `map` blocks and `server` blocks), so the wrapper is
// events{} + http{}. `error_log` and `pid` go to the temp dir: nginx would otherwise write to
// /var/log and refuse on a machine where this runs unprivileged.
function check(name, file, before = null) {
  // nginx binds its listeners during a config test. The container's server listens on a unix
  // socket that only exists once the quadlet volume is mounted, so that line is swapped for a
  // loopback port; a typo in the socket path is the one thing this cannot catch.
  let source = file;
  if (before) {
    const [from, to] = before;
    if (!readFileSync(file, 'utf8').includes(from)) { console.log(`  FAIL  ${name}: expected to find "${from}" to substitute for the test`); failed++; return; }
    source = join(dir, name.replace(/[^\w.-]/g, '_') + '.snippet.conf');
    writeFileSync(source, readFileSync(file, 'utf8').split(from).join(to));   // the header include appears at four levels
  }
  // access_log off: nginx opens /var/log/nginx/access.log during a config test, so an
  // unprivileged run would die there instead of on the config. Port 50999 for the same reason:
  // binding port 1 as an unprivileged user is refused, and colliding with something real is a lie.
  const conf = join(dir, name.replace(/[^\w.-]/g, '_') + '.conf');
  writeFileSync(conf, `pid ${dir}/nginx.pid;\nerror_log ${dir}/error.log;\nevents { worker_connections 16; }\nhttp {\n  access_log off;\n${stubLine}  include ${source};\n}\n`);
  const r = spawnSync('nginx', ['-t', '-c', conf], { encoding: 'utf8' });
  const detail = (r.stderr || r.stdout || '').split('\n').filter((l) => /emerg|\[error\]|successful/.test(l)).join('\n   ');
  if (r.status === 0) { checked++; console.log(`  ok    ${name}`); }
  else { checked++; failed++; console.log(`  FAIL  ${name}\n   ${detail}`); }
}

// The upstream the vhost proxies to belongs to the front proxy; the stub port is a placeholder for
// the same reason the socket is: a config test resolves and binds, and must not have to reach.
stub('upstream showcase_backend { server 127.0.0.1:50998; }');
check('nginx.conf', resolve('nginx.conf'),
  ['listen unix:/socket/nginx.sock;', 'listen 127.0.0.1:50999;']);
// The header list is read from the repo, not from /etc - see the note at the top of the file.
check('deploy/proxy-showcase.conf', resolve('deploy/proxy-showcase.conf'),
  ['include /etc/nginx/showcase/proxy-headers.conf;', `include ${resolve('deploy/proxy-headers.conf')};`]);

console.log(`${checked} configs checked, ${failed} failure(s)`);
process.exit(failed ? 1 : 0);
