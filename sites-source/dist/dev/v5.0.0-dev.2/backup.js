/* Local backup encryption and conflict planning. Encryption and merge run locally. Optional Drive uploads are handled by google-drive.js. */
(function (root) {
  'use strict';
  const FORMAT = 'salarymate-encrypted-backup', VERSION = 1, ITERATIONS = 600000;
  const MAX_BYTES = 30 * 1024 * 1024;
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const cryptoAPI = () => root.crypto?.subtle || fail('此瀏覽器無法使用加密備份，請使用新版瀏覽器及 HTTPS 網址。');
  const aad = () => new TextEncoder().encode(`${FORMAT}:${VERSION}`);
  const b64 = bytes => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return root.btoa(text);
  };
  const bytes = (text, length) => {
    if (typeof text !== 'string' || text.length > MAX_BYTES * 1.4 || text.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) fail('加密備份格式不正確。');
    const result = Uint8Array.from(root.atob(text), c => c.charCodeAt(0));
    if ((length && result.length !== length) || result.length > MAX_BYTES) fail('加密備份格式或大小不正確。');
    return result;
  };
  async function key(password, salt, use) {
    const api = cryptoAPI();
    if (typeof password !== 'string' || !password.length || password.length > 1024) fail('請填寫有效密碼。');
    const material = await api.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return api.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, [use]);
  }
  async function encrypt(value, password) {
    if (password.length < 8) fail('加密密碼至少需要 8 個字元。');
    const plain = new TextEncoder().encode(JSON.stringify(value));
    if (plain.length + 16 > MAX_BYTES) fail('備份過大，無法加密。');
    const salt = root.crypto.getRandomValues(new Uint8Array(16)), iv = root.crypto.getRandomValues(new Uint8Array(12));
    const cipher = await cryptoAPI().encrypt({ name: 'AES-GCM', iv, additionalData: aad(), tagLength: 128 }, await key(password, salt, 'encrypt'), plain);
    return { format: FORMAT, version: VERSION, cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(cipher)) };
  }
  async function decrypt(value, password) {
    if (value?.format !== FORMAT || value.version !== VERSION || value.cipher !== 'AES-256-GCM' || value.kdf !== 'PBKDF2-SHA256' || value.iterations !== ITERATIONS) fail('不支援的加密備份版本或格式。');
    const salt = bytes(value.salt, 16), iv = bytes(value.iv, 12), cipher = bytes(value.ciphertext);
    if (cipher.length < 16) fail('加密備份內容不完整。');
    const secret = await key(password, salt, 'decrypt');
    try {
      const plain = await cryptoAPI().decrypt({ name: 'AES-GCM', iv, additionalData: aad(), tagLength: 128 }, secret, cipher);
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain));
    } catch { fail('密碼不正確，或備份檔案已損毀。請重新輸入密碼。'); }
  }
  const canonical = value => JSON.stringify(value, function (k, v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).filter(x => x !== 'id').sort().map(x => [x, v[x]]));
    return v;
  });
  const stockKey = a => JSON.stringify([a.market, a.symbol.trim().toUpperCase(), a.account || '']);
  const collections = ['companies', 'records', 'overtimeLogs', 'leaveRecords', 'compTimeCredits', 'compTimeSettlements', 'salaryAdjustments', 'yearEndEstimates', 'investmentRecords'];
  const labels = ['公司', '薪資', '加班', '請假', '補休來源', '補休結算', '調薪', '年終設定', '投資收入'];
  function merge(current, incoming, mode = 'overwrite', token = root.crypto.randomUUID()) {
    if (!['overwrite', 'copy', 'restore'].includes(mode)) fail('請選擇匯入方式。');
    const next = mode === 'restore' ? copy(incoming) : copy(current), data = copy(incoming), stats = [];
    if (mode === 'restore') return { next, stats: [], mode };
    const maps = {}, prefix = 'import-' + token + '-', allIds = new Set(); let serial = 0;
    for (const name of collections) for (const row of [...(current[name] || []), ...(incoming[name] || [])]) allIds.add(row.id);
    for (const p of [current.stockPortfolio, incoming.stockPortfolio]) for (const row of [...(p?.assets || []), ...(p?.transactions || [])]) allIds.add(row.id);
    const fresh = () => { let id; do { id = prefix + (++serial); } while (allIds.has(id)); allIds.add(id); return id; };
    const ref = (name, id) => !id ? id : maps[name]?.get(id) || fail('備份缺少關聯資料，無法安全合併。');
    function upsert(name, rows, keyOf, transform = r => r, target = next[name]) {
      maps[name] = new Map(); let added = 0, replaced = 0;
      const matched = new Set(), existing = [...target];
      const byId = new Map(); let byKey;
      existing.forEach((row, index) => { if (!byId.has(row.id)) byId.set(row.id, {row, index}); });
      const matching = r => {
        if (!byKey) {
          byKey = new Map();
          for (const row of existing) {
            const key = keyOf(row), bucket = byKey.get(key) || [];
            bucket.push(row); byKey.set(key, bucket);
          }
        }
        return (byKey.get(keyOf(r)) || []).filter(row => !matched.has(row.id));
      };
      for (const input of rows || []) {
        const r = transform(copy(input)), sameId = mode === 'overwrite' ? byId.get(r.id)?.row : null;
        const matches = mode === 'overwrite' && !sameId ? matching(r) : [];
        if (matches.length > 1) fail('有多筆相同資料，無法判定覆蓋對象。請使用「新增為獨立副本」。');
        const found = sameId || matches[0];
        if (found && matched.has(found.id)) fail('備份中有多筆資料對應同一紀錄，請先檢查來源。');
        r.id = found?.id || (mode === 'copy' || !r.id ? fresh() : r.id);
        maps[name].set(input.id, r.id);
        if (found) { target[byId.get(found.id).index] = r; matched.add(r.id); replaced++; }
        else { target.push(r); added++; }
      }
      stats.push({ name: labels[collections.indexOf(name)] || ({ assets: '股票', transactions: '股票紀錄' })[name], added, replaced });
    }
    const names = new Set(next.companies.map(c => c.name));
    upsert('companies', data.companies, c => JSON.stringify([c.name.trim(), c.employmentStartDate || '']), c => {
      if (mode === 'copy') {
        let n = 1, name; do { name = `${c.name}（匯入副本 ${n++}）`; } while (names.has(name));
        names.add(name); c.name = name; c.isCurrent = false;
      }
      return c;
    });
    const company = r => ({ ...r, companyId: ref('companies', r.companyId) });
    upsert('records', data.records, r => JSON.stringify([r.companyId, r.year, r.month]), r => {
      const result = company(r);
      for (const field of ['customEarnings', 'customDeductions']) for (const item of result[field] || []) {
        if (item.sourceType === 'leave-payroll') item.sourceKey = `leave:${result.companyId}:${result.year}-${String(result.month).padStart(2, '0')}`;
      }
      return result;
    });
    upsert('overtimeLogs', data.overtimeLogs, canonical, company);
    const payrollKeys = new Set();
    for (const r of next.records) {
      const k = JSON.stringify([r.companyId, r.year, r.month]);
      if (payrollKeys.has(k)) fail('同一公司及月份有多筆薪資，請使用「新增為獨立副本」或先檢查來源。');
      payrollKeys.add(k);
    }
    upsert('leaveRecords', data.leaveRecords, canonical, company);
    upsert('compTimeCredits', data.compTimeCredits, r => r.sourceId, r => ({ ...company(r), sourceId: ref('overtimeLogs', r.sourceId) }));
    upsert('compTimeSettlements', data.compTimeSettlements, canonical, r => ({ ...company(r), creditId: ref('compTimeCredits', r.creditId) }));
    upsert('salaryAdjustments', data.salaryAdjustments, r => JSON.stringify([r.companyId, r.effectiveDate]), company);
    upsert('yearEndEstimates', data.yearEndEstimates, r => JSON.stringify([r.companyId, r.year]), company);
    upsert('investmentRecords', data.investmentRecords, canonical, r => ({ ...r, sourceRecordId: ref('records', r.sourceRecordId) }));
    const stock = next.stockPortfolio, importedStock = data.stockPortfolio;
    const accounts = new Set(stock.assets.map(stockKey)), renamed = new Map();
    upsert('assets', importedStock.assets, stockKey, a => {
      if (mode === 'copy') {
        const original = a.account || '投資', baseKey = original;
        if (!renamed.has(baseKey)) {
          let n = 1, account;
          do { account = `${original}（匯入副本 ${n++}）`; } while (stock.assets.some(x => x.account === account));
          renamed.set(baseKey, account);
        }
        a.account = renamed.get(baseKey);
        if (accounts.has(stockKey(a))) fail('備份中有重複股票帳戶。');
        accounts.add(stockKey(a));
      }
      return a;
    }, stock.assets);
    upsert('transactions', importedStock.transactions, canonical, t => ({ ...t, assetId: ref('assets', t.assetId) }), stock.transactions);
    if (importedStock.smartImports?.length) {
      stock.smartImports ||= [];
      for (const entry of importedStock.smartImports) {
        const r = copy(entry); r.assets = (r.assets || []).map(id => maps.assets.get(id)).filter(Boolean);
        const index = stock.smartImports.findIndex(i => i.token === r.token);
        if (mode === 'copy') r.token += '-' + token;
        if (mode === 'overwrite' && index >= 0) stock.smartImports[index] = r; else stock.smartImports.push(r);
      }
    }
    root.SalaryMateStocks.validate(stock);
    const ledger = root.SalaryMateCompTime.ledger({ credits: next.compTimeCredits, settlements: next.compTimeSettlements, leaves: next.leaveRecords, logs: next.overtimeLogs });
    if (ledger.violations.length) fail('合併後的補休來源或餘額不一致，請檢查加班、請假與補休紀錄。');
    return { next, stats, mode };
  }
  root.SalaryMateBackup = { encrypt, decrypt, merge, isEncrypted: value => value?.format === FORMAT };
})(globalThis);
