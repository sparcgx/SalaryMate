import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_VERSION = '3.11.1';
const SCHEMA_VERSION = 13;
const PROJECT_ID = 'appgprj_6aa0d52f0f308191b5f325b9a8e004e4';
const allowDirty = process.argv.includes('--allow-dirty');
const results = [];

const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const command = (executable, args) => {
  const result = spawnSync(executable, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `${executable} ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
};
const gate = (id, label, check) => {
  try {
    const detail = check() || '通過';
    results.push({ id, label, status: 'PASS', detail });
  } catch (error) {
    results.push({ id, label, status: 'FAIL', detail: error.message });
  }
};

const html = read('dist/index.html');
const manifest = JSON.parse(read('.openai/hosting.json'));

gate('G01', 'Sites 發布設定與靜態入口', () => {
  assert(manifest.project_id === PROJECT_ID, 'Sites project_id 與既有專案不一致');
  assert(manifest.static?.directory === 'dist', 'static.directory 必須為 dist');
  assert(fs.existsSync(path.join(ROOT, 'dist/index.html')), 'dist/index.html 不存在');
  assert(fs.statSync(path.join(ROOT, 'dist/index.html')).size > 0, 'dist/index.html 是空檔案');
  return '專案識別、dist 入口與靜態目錄一致';
});

gate('G02', 'v3.11.1 版本、正式名稱與 PWA 資料契約', () => {
  const appVersion = html.match(/const APP_VERSION = '([^']+)'/)?.[1];
  const schemaVersion = Number(html.match(/const SCHEMA_VERSION = (\d+)/)?.[1]);
  assert(appVersion === RELEASE_VERSION, `APP_VERSION 為 ${appVersion || '未找到'}，預期 ${RELEASE_VERSION}`);
  assert(schemaVersion === SCHEMA_VERSION, `SCHEMA_VERSION 為 ${schemaVersion || '未找到'}，預期 ${SCHEMA_VERSION}`);
  assert(html.includes('<h1>個人薪資管理 '), '正式產品名稱尚未定檔為「個人薪資管理」');
  assert(html.includes(`v${RELEASE_VERSION} 生理假月額度版`), '畫面版本標示未同步');
  assert(html.includes("const STORAGE_KEY = 'salarymate_v310_state'"), '正式 localStorage key 遺失');
  assert(html.includes('colorTheme: normalizeColorTheme'), '獨立配色偏好未納入資料契約');
  return `APP v${appVersion}／Schema ${schemaVersion}／儲存契約一致`;
});

gate('G03', '靜態語法、手機結構與功能標記', () => {
  const output = command(process.execPath, ['tests/static-check.mjs']);
  return output.split('\n').at(-1);
});

gate('G04', '既有薪資基線＋PWA 安裝入口＋到職年資＋派遣快照回歸', () => {
  const output = command(process.execPath, ['tests/runtime-smoke.mjs']);
  return output.split('\n').at(-1);
});

gate('G05', '靜態資產可攜性', () => {
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  const external = references.filter((reference) => /^https?:\/\//i.test(reference));
  assert(external.length === 0, `發現外部執行期依賴：${external.join('、')}`);
  const local = references.filter((reference) => !/^(?:#|data:|mailto:|tel:|javascript:)/i.test(reference));
  const missing = local.filter((reference) => {
    const clean = reference.split(/[?#]/)[0];
    const assetPath = clean.startsWith('/') ? path.join(ROOT, 'dist', clean.slice(1)) : path.resolve(ROOT, 'dist', clean);
    return clean && !fs.existsSync(assetPath);
  });
  assert(missing.length === 0, `找不到本機資產：${missing.join('、')}`);
  const pwaManifest = JSON.parse(read('dist/manifest.webmanifest'));
  const serviceWorker = read('dist/sw.js');
  assert(pwaManifest.name === '個人薪資管理', 'PWA 名稱不一致');
  assert(pwaManifest.start_url === './' && pwaManifest.scope === './', 'PWA 啟動路徑或範圍不一致');
  assert(pwaManifest.display === 'standalone', 'PWA 未設定獨立視窗模式');
  assert(pwaManifest.icons.some((icon) => icon.sizes === '192x192'), '缺少 192x192 PWA 圖示');
  assert(pwaManifest.icons.some((icon) => icon.sizes === '512x512'), '缺少 512x512 PWA 圖示');
  for (const asset of ['dist/manifest.webmanifest', 'dist/sw.js', 'dist/icons/icon-192.png', 'dist/icons/icon-512.png', 'dist/icons/icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(ROOT, asset)), `PWA 資產不存在：${asset}`);
  }
  assert(serviceWorker.includes(`salarymate-shell-v${RELEASE_VERSION}`), 'Service Worker 快取版本未同步');
  assert(serviceWorker.includes("event.data?.type === 'SKIP_WAITING'"), 'Service Worker 缺少可控更新流程');
  return `${references.length} 個資產參照可解析；Manifest、圖示、離線 App Shell 與更新流程完整`;
});

gate('G06', '敏感資料與憑證掃描', () => {
  const fileList = command('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const forbiddenNames = fileList.filter((file) => /(^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i.test(file));
  assert(forbiddenNames.length === 0, `不可提交的敏感檔案：${forbiddenNames.join('、')}`);
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
    /sk-[A-Za-z0-9]{32,}/,
    /gh[pousr]_[A-Za-z0-9]{30,}/
  ];
  const hits = [];
  fileList.forEach((file) => {
    const absolute = path.join(ROOT, file);
    if (!fs.statSync(absolute).isFile()) return;
    const content = fs.readFileSync(absolute);
    if (content.includes(0)) return;
    const text = content.toString('utf8');
    if (secretPatterns.some((pattern) => pattern.test(text))) hits.push(file);
  });
  assert(hits.length === 0, `疑似敏感字串：${hits.join('、')}`);
  return `${fileList.length} 個候選檔案未發現憑證或私鑰`;
});

gate('G07', 'Git 差異品質', () => {
  command('git', ['diff', '--check']);
  command('git', ['diff', '--cached', '--check']);
  return '沒有尾端空白或衝突標記';
});

gate('G08', 'Release 候選來源已封存', () => {
  if (allowDirty) return '預檢模式：暫時略過乾淨工作樹要求';
  const status = command('git', ['status', '--porcelain', '--untracked-files=all']);
  assert(status === '', `工作樹尚有未提交變更：\n${status}`);
  return `工作樹乾淨，HEAD ${command('git', ['rev-parse', '--short=12', 'HEAD'])}`;
});

gate('G09', '候選版可視化預覽設定', () => {
  const packageJson = JSON.parse(read('package.json'));
  const viteConfig = read('vite.config.js');
  assert(packageJson.private === true, '預覽套件必須維持 private，避免誤發布');
  assert(packageJson.version === RELEASE_VERSION, 'package.json 版本尚未同步');
  assert(packageJson.scripts?.dev === 'vite', 'package.json 缺少標準 Vite dev 指令');
  assert(typeof packageJson.devDependencies?.vite === 'string', 'Vite 開發依賴尚未封存');
  assert(/root:\s*['"]dist['"]/.test(viteConfig), '預覽根目錄必須指向正式 dist 輸出');
  assert(viteConfig.includes("allowedHosts: ['terminal.local']"), '預覽主機白名單缺少 terminal.local');
  assert(viteConfig.includes("name: 'salarymate-visual-preview'"), '缺少裝置框可視化預覽外掛');
  assert(viteConfig.includes("url.pathname !== '/__preview'"), '缺少 /__preview 裝置預覽入口');
  assert(['mobile', 'tablet', 'desktop'].every((device) => viteConfig.includes(`${device}:`)), '手機／平板／桌機預覽尺寸不完整');
  assert(viteConfig.includes('v3.11.1 生理假月額度裝置預覽'), '裝置預覽版本標示尚未更新為 v3.11.1');
  assert(viteConfig.includes('iframe { box-sizing: content-box;'), '裝置框邊框不得壓縮實際預覽視窗尺寸');
  return 'Vite 直接呈現正式 dist，裝置框內容尺寸與手機／平板／桌機標示一致';
});

const failed = results.filter((result) => result.status === 'FAIL');
console.log(`個人薪資管理 v${RELEASE_VERSION} Regression + Release Gate`);
results.forEach((result) => console.log(`${result.status === 'PASS' ? '✓' : '✗'} ${result.id} ${result.label} — ${result.detail}`));
console.log('');
if (failed.length) {
  console.error(`RELEASE GATE: HOLD (${failed.length}/${results.length} 個硬性門檻失敗)`);
  process.exit(1);
}
if (allowDirty) {
  console.log(`PRECHECK: PASS (${results.length}/${results.length}；G08 乾淨工作樹要求已暫時略過)`);
} else {
  console.log(`RELEASE GATE: PASS (${results.length}/${results.length} 個硬性門檻通過)`);
}
