/* Android-only import adapter. Load before R99 startup.js; keep web exports unchanged.
 * Native v4.3.2 used a nested v1 envelope with different AAD and NFC passwords.
 * The decoded object still passes through the normal v5 validation and preview.
 */
(function (root) {
  'use strict';
  const FORMAT = 'salarymate-encrypted-backup';
  const MAX_PLAINTEXT = 20 * 1024 * 1024;
  const MAX_CIPHERTEXT = 28 * 1024 * 1024;
  const AAD = 'SalaryMate|encrypted-backup|v1';
  const wrappedApis = new WeakMap();
  const invalid = () => { throw new Error('舊版 Android 加密備份格式或大小不正確。'); };
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const decode = (value, limit, exactLength) => {
    if (typeof value !== 'string' || !value.length || value.length > 4 * Math.ceil(limit / 3)
      || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) invalid();
    let bytes;
    try { bytes = Uint8Array.from(root.atob(value), character => character.charCodeAt(0)); }
    catch { invalid(); }
    if (bytes.length > limit || (exactLength && bytes.length !== exactLength)) invalid();
    return bytes;
  };
  const legacyEnvelope = value => value?.format === FORMAT
    && (object(value.kdf) || object(value.cipher));

  async function decryptLegacy(value, password) {
    if (!object(value) || value.format !== FORMAT || value.version !== 1
      || !object(value.kdf) || !object(value.cipher)
      || value.kdf.name !== 'PBKDF2' || value.kdf.hash !== 'SHA-256'
      || !Number.isInteger(value.kdf.iterations)
      || value.kdf.iterations < 100000 || value.kdf.iterations > 1000000
      || value.cipher.name !== 'AES-GCM' || value.cipher.tagLength !== 128) invalid();
    const salt = decode(value.kdf.salt, 16, 16);
    const iv = decode(value.cipher.iv, 12, 12);
    const ciphertext = decode(value.payload, MAX_CIPHERTEXT);
    if (ciphertext.length < 17) invalid();
    if (typeof password !== 'string' || !password.length || password.length > 1024) {
      throw new Error('請填寫有效密碼。');
    }
    const normalized = password.normalize('NFC');
    const api = root.crypto?.subtle;
    if (!api) throw new Error('此裝置無法使用加密備份。');
    const material = await api.importKey('raw', new TextEncoder().encode(normalized), 'PBKDF2', false, ['deriveKey']);
    const secret = await api.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: value.kdf.iterations },
      material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    try {
      const plain = new Uint8Array(await api.decrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(AAD), tagLength: 128 },
        secret, ciphertext
      ));
      if (!plain.length || plain.length > MAX_PLAINTEXT) invalid();
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain));
    } catch {
      throw new Error('密碼不正確，或舊版 Android 備份檔案已損毀。');
    }
  }

  function wrap(api) {
    if (!api || typeof api.decrypt !== 'function') return api;
    if (wrappedApis.has(api)) return wrappedApis.get(api);
    const wrapped = Object.freeze({
      ...api,
      decrypt(value, password) {
        return legacyEnvelope(value)
          ? decryptLegacy(value, password)
          : api.decrypt.call(api, value, password);
      }
    });
    wrappedApis.set(api, wrapped);
    wrappedApis.set(wrapped, wrapped);
    return wrapped;
  }
  const descriptor = Object.getOwnPropertyDescriptor(root, 'SalaryMateBackup');
  if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) return;
  let current = wrap(descriptor?.value);
  Object.defineProperty(root, 'SalaryMateBackup', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: api => { current = wrap(api); }
  });
})(globalThis);
