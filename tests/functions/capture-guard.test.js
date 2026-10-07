// tests/functions/capture-guard.test.js
//
// The guard that keeps the reference-site browser on the public internet
// (netlify/functions/_lib/capture.js): addresses in every form, names,
// ports, schemes, DNS answers (a fake lookup: nothing here asks a real
// resolver), and the proxy every browser connection goes through, run
// against a loopback server of the test's own.
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import {
  CAPTURE_MESSAGES, CAPTURE_PROXY_HEADER, addressReason, captureChromeArgs, checkCaptureUrl, createCaptureGuard, parseIPv4,
  parseIPv6, startCaptureProxy,
} from '../../netlify/functions/_lib/capture.js';

const PUBLIC_V4 = '93.184.215.14';
const PUBLIC_V6 = '2606:2800:21f:cb07:6820:80da:af6b:8b2c';

// A resolver that knows a few names; any other is not found.
function fakeLookup(table = {}) {
  const calls = [];
  const lookup = async (host, opts) => {
    calls.push([host, opts]);
    const v = table[host];
    if (v instanceof Error) throw v;
    if (!v) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
    return v.map((address) => ({ address, family: net.isIP(address) }));
  };
  lookup.calls = calls;
  return lookup;
}

const NAMES = {
  'shop.test': [PUBLIC_V4],
  'v6.shop.test': [PUBLIC_V6],
  'both.shop.test': [PUBLIC_V4, PUBLIC_V6],
  'v6first.shop.test': [PUBLIC_V6, PUBLIC_V4],
  'mixed.shop.test': [PUBLIC_V4, '10.0.0.8'],
  'mixed6.shop.test': [PUBLIC_V6, 'fd12::1'],
  'meta.shop.test': ['169.254.169.254'],
  'mapped.shop.test': ['::ffff:127.0.0.1'],
  'loop.shop.test': ['127.0.0.1'],
  'nat64.shop.test': ['64:ff9b::a9fe:a9fe'],
};

describe('addressReason', () => {
  it('refuses every private, loopback, link-local, multicast, reserved and unspecified IPv4 range', () => {
    const cases = {
      '0.0.0.0': 'unspecified', '0.1.2.3': 'unspecified',
      '10.0.0.1': 'private', '10.255.255.255': 'private',
      '100.64.0.1': 'private', '100.127.255.254': 'private',
      '127.0.0.1': 'loopback', '127.8.9.10': 'loopback',
      '169.254.0.1': 'link-local', '169.254.169.254': 'link-local',
      '172.16.0.1': 'private', '172.31.255.255': 'private',
      '192.168.0.1': 'private', '192.168.255.255': 'private',
      '192.0.0.8': 'reserved', '192.0.2.10': 'reserved', '198.18.0.1': 'reserved', '198.51.100.1': 'reserved', '203.0.113.9': 'reserved',
      '224.0.0.1': 'multicast', '239.255.255.250': 'multicast',
      '240.0.0.1': 'reserved', '255.255.255.255': 'reserved',
    };
    for (const [ip, reason] of Object.entries(cases)) expect(addressReason(ip), ip).toBe(reason);
  });

  it('lets public IPv4 through, right up to the edges of the private ranges', () => {
    for (const ip of [PUBLIC_V4, '8.8.8.8', '1.1.1.1', '9.255.255.255', '11.0.0.0', '100.63.255.255', '100.128.0.0', '126.255.255.255',
      '128.0.0.0', '169.253.255.255', '169.255.0.0', '172.15.255.255', '172.32.0.0', '192.167.255.255', '192.169.0.0', '223.255.255.255']) {
      expect(addressReason(ip), ip).toBe('');
    }
  });

  it('refuses the IPv6 ranges and the IPv6 forms that carry a private IPv4 address', () => {
    const cases = {
      '::': 'unspecified', '::1': 'loopback', '0:0:0:0:0:0:0:1': 'loopback',
      '::ffff:127.0.0.1': 'loopback', '::ffff:7f00:1': 'loopback', '::FFFF:A9FE:A9FE': 'link-local', '::ffff:10.1.2.3': 'private',
      '::ffff:0:192.168.1.1': 'private', // IPv4-translated
      '::127.0.0.1': 'reserved', // IPv4-compatible (retired)
      '64:ff9b::7f00:1': 'loopback', '64:ff9b::169.254.169.254': 'link-local', '64:ff9b:1::1': 'private', // NAT64
      '2002:a9fe:a9fe::1': 'link-local', '2002:0a00:0001::': 'private', // 6to4
      'fc00::1': 'private', 'fd12:3456::1': 'private',
      'fe80::1': 'link-local', 'febf::1': 'link-local', 'fec0::1': 'private',
      'ff02::1': 'multicast', 'ff05::2': 'multicast',
      '2001:db8::1': 'reserved', '2001::1': 'reserved', '100::1': 'reserved', '3fff::1': '',
      '[::1]': 'loopback',
    };
    for (const [ip, reason] of Object.entries(cases)) expect(addressReason(ip), ip).toBe(reason);
    expect(addressReason(PUBLIC_V6)).toBe('');
    expect(addressReason('::ffff:93.184.215.14')).toBe('');
    expect(addressReason('2002:5db8:d70e::1')).toBe(''); // 6to4 of a public address
    expect(addressReason('64:ff9b::808:808')).toBe(''); // NAT64 of 8.8.8.8
  });

  it('reads IPv4 written as one number, in hex or in octal, as a resolver would', () => {
    expect(parseIPv4('2130706433')).toEqual([127, 0, 0, 1]);
    expect(parseIPv4('0x7f000001')).toEqual([127, 0, 0, 1]);
    expect(parseIPv4('017700000001')).toEqual([127, 0, 0, 1]);
    expect(parseIPv4('0x7f.1')).toEqual([127, 0, 0, 1]);
    expect(parseIPv4('127.1')).toEqual([127, 0, 0, 1]);
    expect(parseIPv4('0xa9.0xfe.0xa9.0xfe')).toEqual([169, 254, 169, 254]);
    expect(parseIPv4('2852039166')).toEqual([169, 254, 169, 254]);
    expect(parseIPv4('0')).toEqual([0, 0, 0, 0]);
    expect(parseIPv4('1.2.3.4.')).toEqual([1, 2, 3, 4]);
    for (const bad of ['256.1.1.1', '1.2.3.4.5', '08.1.1.1', '4294967296', '1.2.65536', 'shop.test', '', '1..2']) expect(parseIPv4(bad), bad).toBe(null);
    expect(addressReason('2130706433')).toBe('loopback');
    expect(addressReason('0x7f.1')).toBe('loopback');
    expect(addressReason('not-an-address')).toBe('invalid');
  });

  it('parses IPv6 strictly', () => {
    expect(parseIPv6('::1')).toEqual([...Array(15).fill(0), 1]);
    expect(parseIPv6('::ffff:1.2.3.4').slice(10)).toEqual([0xff, 0xff, 1, 2, 3, 4]);
    for (const bad of ['1:2:3:4:5:6:7:8:9', '1::2::3', ':1', '12345::', 'fe80::1%en0', '::ffff:1.2.3.256', 'g::1', '1.2.3.4']) expect(parseIPv6(bad), bad).toBe(null);
  });
});

describe('createCaptureGuard', () => {
  it('lets a public site through, with the address the proxy will connect to', async () => {
    const lookup = fakeLookup(NAMES);
    const g = createCaptureGuard({ lookup });
    expect(await g.check('https://shop.test/menu?x=1')).toEqual({
      ok: true, url: 'https://shop.test/menu?x=1', host: 'shop.test', port: 443, addresses: [PUBLIC_V4], address: PUBLIC_V4,
    });
    expect((await g.check('http://both.shop.test:8080/')).addresses).toEqual([PUBLIC_V4, PUBLIC_V6]);
    expect((await g.check('http://v6.shop.test/')).ok).toBe(true);
    expect((await g.check(`http://${PUBLIC_V4}/`)).ok).toBe(true);
    expect((await g.check(`https://[${PUBLIC_V6}]:8443/`)).ok).toBe(true);
    // Every address of the name, asked once per guard.
    await g.check('https://shop.test/other');
    expect(lookup.calls.filter(([h]) => h === 'shop.test')).toEqual([['shop.test', { all: true }]]);
  });

  it('connects a dual-stack site over IPv4 whichever address the resolver lists first', async () => {
    const g = createCaptureGuard({ lookup: fakeLookup(NAMES) });
    expect(await g.check('https://v6first.shop.test/')).toMatchObject({ ok: true, addresses: [PUBLIC_V6, PUBLIC_V4], address: PUBLIC_V4 });
    expect((await g.check('https://both.shop.test/')).address).toBe(PUBLIC_V4);
    // An IPv6-only site keeps its own address.
    expect((await g.check('https://v6.shop.test/')).address).toBe(PUBLIC_V6);
  });

  it('refuses a name when ANY of its addresses is private', async () => {
    const g = createCaptureGuard({ lookup: fakeLookup(NAMES) });
    for (const host of ['mixed.shop.test', 'mixed6.shop.test', 'meta.shop.test', 'mapped.shop.test', 'loop.shop.test', 'nat64.shop.test']) {
      expect(await g.check(`https://${host}/`), host).toEqual({ ok: false, code: 'private', error: CAPTURE_MESSAGES.private });
    }
  });

  it('refuses IP hosts written in decimal, hex, octal or as IPv6-mapped addresses, without asking DNS', async () => {
    const lookup = fakeLookup(NAMES);
    const g = createCaptureGuard({ lookup });
    for (const url of [
      'http://2130706433/', 'http://0x7f000001/', 'http://017700000001/', 'http://0x7f.1/', 'http://127.1/', 'http://0/',
      'http://2852039166/latest/meta-data/', 'http://0xa9.0xfe.0xa9.0xfe/', 'http://169.254.169.254/', 'http://10.0.0.1:8080/',
      'http://192.168.1.1/', 'http://172.16.5.4/', 'http://100.64.1.1/', 'http://224.0.0.1/', 'http://0.0.0.0/',
      'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:a9fe:a9fe]/', 'http://[::ffff:10.0.0.1]/', 'http://[fd00::1]/',
      'http://[fe80::1]/', 'http://[::]/', 'http://[64:ff9b::a9fe:a9fe]/', 'http://[2002:a9fe:a9fe::]/', 'http://[ff02::1]/',
    ]) {
      expect((await g.check(url)).code, url).toBe('private');
    }
    expect(lookup.calls).toEqual([]);
  });

  it('refuses local names before any lookup', async () => {
    const lookup = fakeLookup({ 'localhost': [PUBLIC_V4], 'printer.local': [PUBLIC_V4], 'metadata.google.internal': [PUBLIC_V4] });
    const g = createCaptureGuard({ lookup });
    for (const url of ['http://localhost/', 'http://LOCALHOST./', 'http://app.localhost/', 'http://printer.local/', 'http://metadata.google.internal/',
      'http://router.home.arpa/', 'http://box.localdomain/', 'http://intranet/']) {
      expect((await g.check(url)).code, url).toBe('private');
    }
    expect(lookup.calls).toEqual([]);
  });

  it('allows http and https on the default ports or 80/443/8080/8443 only, without credentials', async () => {
    const g = createCaptureGuard({ lookup: fakeLookup(NAMES) });
    for (const port of [80, 443, 8080, 8443]) expect((await g.check(`http://shop.test:${port}/`)).ok, port).toBe(true);
    for (const url of ['http://shop.test:22/', 'https://shop.test:6379/', 'http://shop.test:3000/', 'https://shop.test:1/']) {
      expect(await g.check(url), url).toEqual({ ok: false, code: 'port', error: CAPTURE_MESSAGES.port });
    }
    expect((await g.check('https://admin:secret@shop.test/')).code).toBe('credentials');
    expect((await g.check('https://admin@shop.test/')).code).toBe('credentials');
    for (const url of ['file:///etc/passwd', 'ftp://shop.test/', 'gopher://shop.test/', 'javascript:alert(1)', 'data:text/html,hi', 'chrome://settings']) {
      expect((await g.check(url)).code, url).toBe('scheme');
    }
    for (const url of ['', 'shop.test', 'http://', 'not a url', null, undefined]) expect((await g.check(url)).code, String(url)).toBe('invalid');
  });

  it('says when a name doesn\'t resolve, or the resolver fails or hangs', async () => {
    const lookup = fakeLookup({
      'down.shop.test': Object.assign(new Error('queryA ESERVFAIL'), { code: 'ESERVFAIL' }),
      'empty.shop.test': [],
    });
    const g = createCaptureGuard({ lookup });
    expect((await g.check('https://nowhere.shop.test/')).code).toBe('not_found');
    expect((await g.check('https://empty.shop.test/')).code).toBe('not_found');
    expect((await g.check('https://down.shop.test/')).code).toBe('dns');
    const slow = createCaptureGuard({ lookup: () => new Promise(() => {}), lookupTimeoutMs: 20 });
    expect((await slow.check('https://slow.shop.test/')).code).toBe('dns');
  });

  it('lets loopback through only with the explicit test-only option, and nothing else private', async () => {
    const lookup = fakeLookup(NAMES);
    expect((await checkCaptureUrl('http://127.0.0.1:54321/', { lookup })).code).toBe('port');
    expect((await checkCaptureUrl('http://127.0.0.1/', { lookup })).code).toBe('private');
    expect((await checkCaptureUrl('http://127.0.0.1/', { lookup, testOnly: { allowLoopback: 'yes' } })).code).toBe('private');
    const t = createCaptureGuard({ lookup, testOnly: { allowLoopback: true } });
    expect((await t.check('http://127.0.0.1:54321/')).ok).toBe(true);
    expect((await t.check('http://[::1]:54321/')).ok).toBe(true);
    expect((await t.check('http://loop.shop.test:54321/')).ok).toBe(true);
    // Still refused under the test option: other private ranges, any
    // other port but to loopback, and the name "localhost".
    expect((await t.check('http://10.0.0.1/')).code).toBe('private');
    expect((await t.check('http://169.254.169.254/')).code).toBe('private');
    expect((await t.check('http://mixed.shop.test/')).code).toBe('private');
    expect((await t.check('http://shop.test:6379/')).code).toBe('port');
    expect((await t.check('http://localhost:54321/')).code).toBe('private');
  });

  it('keeps a short list of what it refused', async () => {
    const g = createCaptureGuard({ lookup: fakeLookup(NAMES) });
    await g.check('http://10.0.0.1/x');
    await g.check('https://shop.test/');
    expect(g.refused).toEqual([{ url: 'http://10.0.0.1/x', code: 'private' }]);
  });
});

describe('captureChromeArgs', () => {
  it('sends everything through the proxy, loopback included, and leaves the browser no resolver or UDP of its own', () => {
    const args = captureChromeArgs('http://127.0.0.1:4567');
    expect(args).toContain('--proxy-server=http://127.0.0.1:4567');
    expect(args).toContain('--proxy-bypass-list=<-loopback>');
    expect(args).toContain('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1');
    // WebRTC's UDP, under the switch each kind of build reads:
    // chrome-headless-shell (the function) and a full Chrome (the local test).
    expect(args).toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(args).toContain('--webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(args).toContain('--disable-quic');
  });
});

// ─── The proxy, against a loopback server ─────────────────────────────

describe('startCaptureProxy', () => {
  let target;
  let proxy;
  const seen = [];
  async function startTarget() {
    target = http.createServer((req, res) => {
      seen.push({ host: req.headers.host, url: req.url, proxyConnection: req.headers['proxy-connection'] });
      res.writeHead(200, { 'content-type': 'text/plain', 'set-cookie': ['a=1', 'b=2'] });
      res.end(`hello ${req.url}`);
    });
    await new Promise((r) => target.listen(0, '127.0.0.1', r));
    return target.address().port;
  }
  afterEach(async () => {
    seen.length = 0;
    if (proxy) await proxy.close();
    if (target) await new Promise((r) => target.close(r));
    proxy = null;
    target = null;
  });

  // A plain-http request the way a browser sends it to a proxy.
  function viaProxy(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: proxy.port, method: 'GET', path: url, headers: { host: new URL(url).host, 'proxy-connection': 'keep-alive', ...headers } }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }
  // A CONNECT; on 200, a request sent through the tunnel.
  function tunnel(hostPort, then = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: proxy.port, method: 'CONNECT', path: hostPort });
      req.on('connect', (res, socket) => {
        if (res.statusCode !== 200 || !then) {
          socket.destroy();
          resolve({ status: res.statusCode, headers: res.headers });
          return;
        }
        let data = '';
        socket.on('data', (c) => { data += c; });
        socket.on('end', () => resolve({ status: res.statusCode, data }));
        socket.write(then);
      });
      req.on('error', reject);
      req.end();
    });
  }

  it('forwards plain http to the checked address, without the proxy\'s own headers', async () => {
    const port = await startTarget();
    const guard = createCaptureGuard({ lookup: fakeLookup({ 'assets.shop.test': ['127.0.0.1'] }), testOnly: { allowLoopback: true } });
    proxy = await startCaptureProxy(guard);
    const res = await viaProxy(`http://assets.shop.test:${port}/img.png?w=2`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('hello /img.png?w=2');
    expect(res.headers['set-cookie']).toEqual(['a=1', 'b=2']);
    expect(seen).toEqual([{ host: `assets.shop.test:${port}`, url: '/img.png?w=2', proxyConnection: undefined }]);
  });

  it('opens a tunnel only to an address the guard allows', async () => {
    const port = await startTarget();
    const guard = createCaptureGuard({
      lookup: fakeLookup({ 'assets.shop.test': ['127.0.0.1'], 'evil.shop.test': ['10.0.0.5'], 'pub.shop.test': [PUBLIC_V4] }),
      testOnly: { allowLoopback: true },
    });
    proxy = await startCaptureProxy(guard);
    const ok = await tunnel(`assets.shop.test:${port}`, 'GET /through HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
    expect(ok.status).toBe(200);
    expect(ok.data).toContain('hello /through');
    const evil = await tunnel('evil.shop.test:443');
    expect(evil.status).toBe(403);
    expect(evil.headers[CAPTURE_PROXY_HEADER]).toBe('private');
    expect((await tunnel('169.254.169.254:80')).status).toBe(403);
    // (The test option opens any port, but only to loopback.)
    const ssh = await tunnel('pub.shop.test:22');
    expect([ssh.status, ssh.headers[CAPTURE_PROXY_HEADER]]).toEqual([403, 'port']);
    expect((await tunnel('user@assets.shop.test:443')).status).toBe(400);
    expect(seen.map((s) => s.url)).toEqual(['/through']);
  });

  it('refuses loopback without the test-only option, even to a name that resolves there', async () => {
    const port = await startTarget();
    proxy = await startCaptureProxy(createCaptureGuard({ lookup: fakeLookup({ 'rebind.shop.test': ['127.0.0.1'] }) }));
    const res = await viaProxy(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(403);
    expect(res.headers[CAPTURE_PROXY_HEADER]).toBe('port');
    expect((await viaProxy('http://rebind.shop.test/')).status).toBe(403);
    expect((await viaProxy('http://127.0.0.1/')).headers[CAPTURE_PROXY_HEADER]).toBe('private');
    expect((await tunnel('127.0.0.1:443')).status).toBe(403);
    expect(seen).toEqual([]);
  });

  it('connects to the address it checked, not to what the name resolves to later (DNS rebinding)', async () => {
    const port = await startTarget();
    // The first answer is the one checked; a later one would be private.
    let answers = 0;
    const lookup = async () => {
      answers += 1;
      return [{ address: answers === 1 ? '127.0.0.1' : '10.9.9.9', family: 4 }];
    };
    const guard = createCaptureGuard({ lookup, testOnly: { allowLoopback: true } });
    expect((await guard.check(`http://rebind.shop.test:${port}/`)).ok).toBe(true);
    proxy = await startCaptureProxy(guard);
    const res = await viaProxy(`http://rebind.shop.test:${port}/again`);
    expect(res.status).toBe(200);
    expect(answers).toBe(1);
  });

  it('answers 502 (marked as its own) when the site can\'t be reached', async () => {
    const port = await startTarget();
    await new Promise((r) => target.close(r));
    target = null;
    proxy = await startCaptureProxy(createCaptureGuard({ lookup: fakeLookup(), testOnly: { allowLoopback: true } }));
    const res = await viaProxy(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(502);
    expect(res.headers[CAPTURE_PROXY_HEADER]).toBe('unreachable');
    expect((await tunnel(`127.0.0.1:${port}`)).status).toBe(502);
  });

  it('takes only absolute http requests', async () => {
    await startTarget();
    proxy = await startCaptureProxy(createCaptureGuard({ lookup: fakeLookup(), testOnly: { allowLoopback: true } }));
    const res = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: proxy.port, path: '/just-a-path' }, (r) => { r.resume(); resolve(r); });
    });
    expect(res.statusCode).toBe(403);
    expect(seen).toEqual([]);
  });
});
