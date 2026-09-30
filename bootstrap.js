var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/core/dist/index.js
var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
var init_dist = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/core/dist/index.js"() {
    (function(ExceptionCode2) {
      ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode2["Unavailable"] = "UNAVAILABLE";
    })(ExceptionCode || (ExceptionCode = {}));
    CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform2 = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform2 in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform2] === "function" ? jsImplementation = await jsImplementations[platform2]() : jsImplementation = jsImplementations[platform2];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform2}`, ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform2}`, ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve2) => call.then(() => resolve2({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform2] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    registerPlugin = Capacitor.registerPlugin;
    WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        if (index !== -1) {
          this.listeners[eventName].splice(index, 1);
        }
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    readBlobAsBase64 = async (blob) => new Promise((resolve2, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve2(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    (function(SystemBarsStyle2) {
      SystemBarsStyle2["Dark"] = "DARK";
      SystemBarsStyle2["Light"] = "LIGHT";
      SystemBarsStyle2["Default"] = "DEFAULT";
    })(SystemBarsStyle || (SystemBarsStyle = {}));
    (function(SystemBarType2) {
      SystemBarType2["StatusBar"] = "StatusBar";
      SystemBarType2["NavigationBar"] = "NavigationBar";
    })(SystemBarType || (SystemBarType = {}));
    SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
  }
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor-community/sqlite/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  CapacitorSQLiteWeb: () => CapacitorSQLiteWeb
});
var CapacitorSQLiteWeb;
var init_web = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor-community/sqlite/dist/esm/web.js"() {
    init_dist();
    CapacitorSQLiteWeb = class extends WebPlugin {
      constructor() {
        super(...arguments);
        this.jeepSqliteElement = null;
        this.isWebStoreOpen = false;
      }
      async initWebStore() {
        await customElements.whenDefined("jeep-sqlite");
        this.jeepSqliteElement = document.querySelector("jeep-sqlite");
        this.ensureJeepSqliteIsAvailable();
        this.jeepSqliteElement.addEventListener("jeepSqliteImportProgress", (event) => {
          this.notifyListeners("sqliteImportProgressEvent", event.detail);
        });
        this.jeepSqliteElement.addEventListener("jeepSqliteExportProgress", (event) => {
          this.notifyListeners("sqliteExportProgressEvent", event.detail);
        });
        this.jeepSqliteElement.addEventListener("jeepSqliteHTTPRequestEnded", (event) => {
          this.notifyListeners("sqliteHTTPRequestEndedEvent", event.detail);
        });
        this.jeepSqliteElement.addEventListener("jeepSqlitePickDatabaseEnded", (event) => {
          this.notifyListeners("sqlitePickDatabaseEndedEvent", event.detail);
        });
        this.jeepSqliteElement.addEventListener("jeepSqliteSaveDatabaseToDisk", (event) => {
          this.notifyListeners("sqliteSaveDatabaseToDiskEvent", event.detail);
        });
        if (!this.isWebStoreOpen) {
          this.isWebStoreOpen = await this.jeepSqliteElement.isStoreOpen();
        }
        return;
      }
      async saveToStore(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.saveToStore(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async getFromLocalDiskToStore(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.getFromLocalDiskToStore(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async saveToLocalDisk(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.saveToLocalDisk(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async echo(options) {
        this.ensureJeepSqliteIsAvailable();
        const echoResult = await this.jeepSqliteElement.echo(options);
        return echoResult;
      }
      async createConnection(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.createConnection(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async open(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.open(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async closeConnection(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.closeConnection(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async getVersion(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const versionResult = await this.jeepSqliteElement.getVersion(options);
          return versionResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async checkConnectionsConsistency(options) {
        this.ensureJeepSqliteIsAvailable();
        try {
          const consistencyResult = await this.jeepSqliteElement.checkConnectionsConsistency(options);
          return consistencyResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async close(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.close(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async beginTransaction(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const changes = await this.jeepSqliteElement.beginTransaction(options);
          return changes;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async commitTransaction(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const changes = await this.jeepSqliteElement.commitTransaction(options);
          return changes;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async rollbackTransaction(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const changes = await this.jeepSqliteElement.rollbackTransaction(options);
          return changes;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async isTransactionActive(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const result = await this.jeepSqliteElement.isTransactionActive(options);
          return result;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async getTableList(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const tableListResult = await this.jeepSqliteElement.getTableList(options);
          return tableListResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async execute(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const executeResult = await this.jeepSqliteElement.execute(options);
          return executeResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async executeSet(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const executeResult = await this.jeepSqliteElement.executeSet(options);
          return executeResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async run(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const runResult = await this.jeepSqliteElement.run(options);
          return runResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async query(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const queryResult = await this.jeepSqliteElement.query(options);
          return queryResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async isDBExists(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const dbExistsResult = await this.jeepSqliteElement.isDBExists(options);
          return dbExistsResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async isDBOpen(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const isDBOpenResult = await this.jeepSqliteElement.isDBOpen(options);
          return isDBOpenResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async isDatabase(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const isDatabaseResult = await this.jeepSqliteElement.isDatabase(options);
          return isDatabaseResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async isTableExists(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const tableExistsResult = await this.jeepSqliteElement.isTableExists(options);
          return tableExistsResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async deleteDatabase(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.deleteDatabase(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async isJsonValid(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const isJsonValidResult = await this.jeepSqliteElement.isJsonValid(options);
          return isJsonValidResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async importFromJson(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const importFromJsonResult = await this.jeepSqliteElement.importFromJson(options);
          return importFromJsonResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async exportToJson(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const exportToJsonResult = await this.jeepSqliteElement.exportToJson(options);
          return exportToJsonResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async createSyncTable(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const createSyncTableResult = await this.jeepSqliteElement.createSyncTable(options);
          return createSyncTableResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async setSyncDate(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.setSyncDate(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async getSyncDate(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const getSyncDateResult = await this.jeepSqliteElement.getSyncDate(options);
          return getSyncDateResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async deleteExportedRows(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.deleteExportedRows(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async addUpgradeStatement(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.addUpgradeStatement(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async copyFromAssets(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.copyFromAssets(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async getFromHTTPRequest(options) {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          await this.jeepSqliteElement.getFromHTTPRequest(options);
          return;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      async getDatabaseList() {
        this.ensureJeepSqliteIsAvailable();
        this.ensureWebstoreIsOpen();
        try {
          const databaseListResult = await this.jeepSqliteElement.getDatabaseList();
          return databaseListResult;
        } catch (err) {
          throw new Error(`${err}`);
        }
      }
      /**
       * Checks if the `jeep-sqlite` element is present in the DOM.
       * If it's not in the DOM, this method throws an Error.
       *
       * Attention: This will always fail, if the `intWebStore()` method wasn't called before.
       */
      ensureJeepSqliteIsAvailable() {
        if (this.jeepSqliteElement === null) {
          throw new Error(`The jeep-sqlite element is not present in the DOM! Please check the @capacitor-community/sqlite documentation for instructions regarding the web platform.`);
        }
      }
      ensureWebstoreIsOpen() {
        if (!this.isWebStoreOpen) {
          throw new Error('WebStore is not open yet. You have to call "initWebStore()" first.');
        }
      }
      ////////////////////////////////////
      ////// UNIMPLEMENTED METHODS
      ////////////////////////////////////
      async getUrl() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getMigratableDbList(options) {
        console.log("getMigratableDbList", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async addSQLiteSuffix(options) {
        console.log("addSQLiteSuffix", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async deleteOldDatabases(options) {
        console.log("deleteOldDatabases", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async moveDatabasesAndAddSuffix(options) {
        console.log("moveDatabasesAndAddSuffix", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async isSecretStored() {
        throw this.unimplemented("Not implemented on web.");
      }
      async setEncryptionSecret(options) {
        console.log("setEncryptionSecret", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async changeEncryptionSecret(options) {
        console.log("changeEncryptionSecret", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async clearEncryptionSecret() {
        console.log("clearEncryptionSecret");
        throw this.unimplemented("Not implemented on web.");
      }
      async checkEncryptionSecret(options) {
        console.log("checkEncryptionPassPhrase", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async getNCDatabasePath(options) {
        console.log("getNCDatabasePath", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async createNCConnection(options) {
        console.log("createNCConnection", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async closeNCConnection(options) {
        console.log("closeNCConnection", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async isNCDatabase(options) {
        console.log("isNCDatabase", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async isDatabaseEncrypted(options) {
        console.log("isDatabaseEncrypted", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async isInConfigEncryption() {
        throw this.unimplemented("Not implemented on web.");
      }
      async isInConfigBiometricAuth() {
        throw this.unimplemented("Not implemented on web.");
      }
      async loadExtension(options) {
        console.log("loadExtension", options);
        throw this.unimplemented("Not implemented on web.");
      }
      async enableLoadExtension(options) {
        console.log("enableLoadExtension", options);
        throw this.unimplemented("Not implemented on web.");
      }
    };
  }
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/filesystem/dist/esm/definitions.js
var Directory, Encoding;
var init_definitions = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/filesystem/dist/esm/definitions.js"() {
    (function(Directory2) {
      Directory2["Documents"] = "DOCUMENTS";
      Directory2["Data"] = "DATA";
      Directory2["Library"] = "LIBRARY";
      Directory2["Cache"] = "CACHE";
      Directory2["External"] = "EXTERNAL";
      Directory2["ExternalStorage"] = "EXTERNAL_STORAGE";
      Directory2["ExternalCache"] = "EXTERNAL_CACHE";
      Directory2["LibraryNoCloud"] = "LIBRARY_NO_CLOUD";
      Directory2["Temporary"] = "TEMPORARY";
    })(Directory || (Directory = {}));
    (function(Encoding2) {
      Encoding2["UTF8"] = "utf8";
      Encoding2["ASCII"] = "ascii";
      Encoding2["UTF16"] = "utf16";
    })(Encoding || (Encoding = {}));
  }
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/filesystem/dist/esm/web.js
var web_exports2 = {};
__export(web_exports2, {
  FilesystemWeb: () => FilesystemWeb
});
function resolve(path) {
  const posix = path.split("/").filter((item) => item !== ".");
  const newPosix = [];
  posix.forEach((item) => {
    if (item === ".." && newPosix.length > 0 && newPosix[newPosix.length - 1] !== "..") {
      newPosix.pop();
    } else {
      newPosix.push(item);
    }
  });
  return newPosix.join("/");
}
function isPathParent(parent, children) {
  parent = resolve(parent);
  children = resolve(children);
  const pathsA = parent.split("/");
  const pathsB = children.split("/");
  return parent !== children && pathsA.every((value, index) => value === pathsB[index]);
}
var FilesystemWeb;
var init_web2 = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/filesystem/dist/esm/web.js"() {
    init_dist();
    init_definitions();
    FilesystemWeb = class _FilesystemWeb extends WebPlugin {
      constructor() {
        super(...arguments);
        this.DB_VERSION = 1;
        this.DB_NAME = "Disc";
        this._writeCmds = ["add", "put", "delete"];
        this.downloadFile = async (options) => {
          var _a, _b;
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const response = await fetch(options.url, requestInit);
          let blob;
          if (!options.progress)
            blob = await response.blob();
          else if (!(response === null || response === void 0 ? void 0 : response.body))
            blob = new Blob();
          else {
            const reader = response.body.getReader();
            let bytes = 0;
            const chunks = [];
            const contentType = response.headers.get("content-type");
            const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
            while (true) {
              const { done, value } = await reader.read();
              if (done)
                break;
              chunks.push(value);
              bytes += (value === null || value === void 0 ? void 0 : value.length) || 0;
              const status2 = {
                url: options.url,
                bytes,
                contentLength
              };
              this.notifyListeners("progress", status2);
            }
            const allChunks = new Uint8Array(bytes);
            let position = 0;
            for (const chunk of chunks) {
              if (typeof chunk === "undefined")
                continue;
              allChunks.set(chunk, position);
              position += chunk.length;
            }
            blob = new Blob([allChunks.buffer], { type: contentType || void 0 });
          }
          const result = await this.writeFile({
            path: options.path,
            directory: (_a = options.directory) !== null && _a !== void 0 ? _a : void 0,
            recursive: (_b = options.recursive) !== null && _b !== void 0 ? _b : false,
            data: blob
          });
          return { path: result.uri, blob };
        };
      }
      readFileInChunks(_options, _callback) {
        throw this.unavailable("Method not implemented.");
      }
      async initDb() {
        if (this._db !== void 0) {
          return this._db;
        }
        if (!("indexedDB" in window)) {
          throw this.unavailable("This browser doesn't support IndexedDB");
        }
        return new Promise((resolve2, reject) => {
          const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
          request.onupgradeneeded = _FilesystemWeb.doUpgrade;
          request.onsuccess = () => {
            this._db = request.result;
            resolve2(request.result);
          };
          request.onerror = () => reject(request.error);
          request.onblocked = () => {
            console.warn("db blocked");
          };
        });
      }
      static doUpgrade(event) {
        const eventTarget = event.target;
        const db = eventTarget.result;
        switch (event.oldVersion) {
          case 0:
          case 1:
          default: {
            if (db.objectStoreNames.contains("FileStorage")) {
              db.deleteObjectStore("FileStorage");
            }
            const store = db.createObjectStore("FileStorage", { keyPath: "path" });
            store.createIndex("by_folder", "folder");
          }
        }
      }
      async dbRequest(cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
        return this.initDb().then((conn) => {
          return new Promise((resolve2, reject) => {
            const tx = conn.transaction(["FileStorage"], readFlag);
            const store = tx.objectStore("FileStorage");
            const req = store[cmd](...args);
            req.onsuccess = () => resolve2(req.result);
            req.onerror = () => reject(req.error);
          });
        });
      }
      async dbIndexRequest(indexName, cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
        return this.initDb().then((conn) => {
          return new Promise((resolve2, reject) => {
            const tx = conn.transaction(["FileStorage"], readFlag);
            const store = tx.objectStore("FileStorage");
            const index = store.index(indexName);
            const req = index[cmd](...args);
            req.onsuccess = () => resolve2(req.result);
            req.onerror = () => reject(req.error);
          });
        });
      }
      getPath(directory, uriPath) {
        const cleanedUriPath = uriPath !== void 0 ? uriPath.replace(/^[/]+|[/]+$/g, "") : "";
        let fsPath = "";
        if (directory !== void 0)
          fsPath += "/" + directory;
        if (uriPath !== "")
          fsPath += "/" + cleanedUriPath;
        return fsPath;
      }
      async clear() {
        const conn = await this.initDb();
        const tx = conn.transaction(["FileStorage"], "readwrite");
        const store = tx.objectStore("FileStorage");
        store.clear();
      }
      /**
       * Read a file from disk
       * @param options options for the file read
       * @return a promise that resolves with the read file data result
       */
      async readFile(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path]);
        if (entry === void 0)
          throw Error("File does not exist.");
        return { data: entry.content ? entry.content : "" };
      }
      /**
       * Write a file to disk in the specified location on device
       * @param options options for the file write
       * @return a promise that resolves with the file write result
       */
      async writeFile(options) {
        const path = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const doRecursive = options.recursive;
        const occupiedEntry = await this.dbRequest("get", [path]);
        if (occupiedEntry && occupiedEntry.type === "directory")
          throw Error("The supplied path is a directory.");
        const parentPath = path.substr(0, path.lastIndexOf("/"));
        const parentEntry = await this.dbRequest("get", [parentPath]);
        if (parentEntry === void 0) {
          const subDirIndex = parentPath.indexOf("/", 1);
          if (subDirIndex !== -1) {
            const parentArgPath = parentPath.substr(subDirIndex);
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: doRecursive
            });
          }
        }
        if (!encoding && !(data instanceof Blob)) {
          data = data.indexOf(",") >= 0 ? data.split(",")[1] : data;
          if (!this.isBase64String(data))
            throw Error("The supplied data is not valid base64 content.");
        }
        const now = Date.now();
        const pathObj = {
          path,
          folder: parentPath,
          type: "file",
          size: data instanceof Blob ? data.size : data.length,
          ctime: now,
          mtime: now,
          content: data
        };
        await this.dbRequest("put", [pathObj]);
        return {
          uri: pathObj.path
        };
      }
      /**
       * Append to a file on disk in the specified location on device
       * @param options options for the file append
       * @return a promise that resolves with the file write result
       */
      async appendFile(options) {
        const path = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const parentPath = path.substr(0, path.lastIndexOf("/"));
        const now = Date.now();
        let ctime = now;
        const occupiedEntry = await this.dbRequest("get", [path]);
        if (occupiedEntry && occupiedEntry.type === "directory")
          throw Error("The supplied path is a directory.");
        const parentEntry = await this.dbRequest("get", [parentPath]);
        if (parentEntry === void 0) {
          const subDirIndex = parentPath.indexOf("/", 1);
          if (subDirIndex !== -1) {
            const parentArgPath = parentPath.substr(subDirIndex);
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: true
            });
          }
        }
        if (!encoding && !this.isBase64String(data))
          throw Error("The supplied data is not valid base64 content.");
        if (occupiedEntry !== void 0) {
          if (occupiedEntry.content instanceof Blob) {
            throw Error("The occupied entry contains a Blob object which cannot be appended to.");
          }
          if (occupiedEntry.content !== void 0 && !encoding) {
            data = btoa(atob(occupiedEntry.content) + atob(data));
          } else {
            data = occupiedEntry.content + data;
          }
          ctime = occupiedEntry.ctime;
        }
        const pathObj = {
          path,
          folder: parentPath,
          type: "file",
          size: data.length,
          ctime,
          mtime: now,
          content: data
        };
        await this.dbRequest("put", [pathObj]);
      }
      /**
       * Delete a file from disk
       * @param options options for the file delete
       * @return a promise that resolves with the deleted file data result
       */
      async deleteFile(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path]);
        if (entry === void 0)
          throw Error("File does not exist.");
        const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
        if (entries.length !== 0)
          throw Error("Folder is not empty.");
        await this.dbRequest("delete", [path]);
      }
      /**
       * Create a directory.
       * @param options options for the mkdir
       * @return a promise that resolves with the mkdir result
       */
      async mkdir(options) {
        const path = this.getPath(options.directory, options.path);
        const doRecursive = options.recursive;
        const parentPath = path.substr(0, path.lastIndexOf("/"));
        const depth = (path.match(/\//g) || []).length;
        const parentEntry = await this.dbRequest("get", [parentPath]);
        const occupiedEntry = await this.dbRequest("get", [path]);
        if (depth === 1)
          throw Error("Cannot create Root directory");
        if (occupiedEntry !== void 0)
          throw Error("Current directory does already exist.");
        if (!doRecursive && depth !== 2 && parentEntry === void 0)
          throw Error("Parent directory must exist");
        if (doRecursive && depth !== 2 && parentEntry === void 0) {
          const parentArgPath = parentPath.substr(parentPath.indexOf("/", 1));
          await this.mkdir({
            path: parentArgPath,
            directory: options.directory,
            recursive: doRecursive
          });
        }
        const now = Date.now();
        const pathObj = {
          path,
          folder: parentPath,
          type: "directory",
          size: 0,
          ctime: now,
          mtime: now
        };
        await this.dbRequest("put", [pathObj]);
      }
      /**
       * Remove a directory
       * @param options the options for the directory remove
       */
      async rmdir(options) {
        const { path, directory, recursive } = options;
        const fullPath = this.getPath(directory, path);
        const entry = await this.dbRequest("get", [fullPath]);
        if (entry === void 0)
          throw Error("Folder does not exist.");
        if (entry.type !== "directory")
          throw Error("Requested path is not a directory");
        const readDirResult = await this.readdir({ path, directory });
        if (readDirResult.files.length !== 0 && !recursive)
          throw Error("Folder is not empty");
        for (const entry2 of readDirResult.files) {
          const entryPath = `${path}/${entry2.name}`;
          const entryObj = await this.stat({ path: entryPath, directory });
          if (entryObj.type === "file") {
            await this.deleteFile({ path: entryPath, directory });
          } else {
            await this.rmdir({ path: entryPath, directory, recursive });
          }
        }
        await this.dbRequest("delete", [fullPath]);
      }
      /**
       * Return a list of files from the directory (not recursive)
       * @param options the options for the readdir operation
       * @return a promise that resolves with the readdir directory listing result
       */
      async readdir(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path]);
        if (options.path !== "" && entry === void 0)
          throw Error("Folder does not exist.");
        const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
        const files = await Promise.all(entries.map(async (e) => {
          let subEntry = await this.dbRequest("get", [e]);
          if (subEntry === void 0) {
            subEntry = await this.dbRequest("get", [e + "/"]);
          }
          return {
            name: e.substring(path.length + 1),
            type: subEntry.type,
            size: subEntry.size,
            ctime: subEntry.ctime,
            mtime: subEntry.mtime,
            uri: subEntry.path
          };
        }));
        return { files };
      }
      /**
       * Return full File URI for a path and directory
       * @param options the options for the stat operation
       * @return a promise that resolves with the file stat result
       */
      async getUri(options) {
        const path = this.getPath(options.directory, options.path);
        let entry = await this.dbRequest("get", [path]);
        if (entry === void 0) {
          entry = await this.dbRequest("get", [path + "/"]);
        }
        return {
          uri: (entry === null || entry === void 0 ? void 0 : entry.path) || path
        };
      }
      /**
       * Return data about a file
       * @param options the options for the stat operation
       * @return a promise that resolves with the file stat result
       */
      async stat(options) {
        const path = this.getPath(options.directory, options.path);
        let entry = await this.dbRequest("get", [path]);
        if (entry === void 0) {
          entry = await this.dbRequest("get", [path + "/"]);
        }
        if (entry === void 0)
          throw Error("Entry does not exist.");
        return {
          name: entry.path.substring(path.length + 1),
          type: entry.type,
          size: entry.size,
          ctime: entry.ctime,
          mtime: entry.mtime,
          uri: entry.path
        };
      }
      /**
       * Rename a file or directory
       * @param options the options for the rename operation
       * @return a promise that resolves with the rename result
       */
      async rename(options) {
        await this._copy(options, true);
        return;
      }
      /**
       * Copy a file or directory
       * @param options the options for the copy operation
       * @return a promise that resolves with the copy result
       */
      async copy(options) {
        return this._copy(options, false);
      }
      async requestPermissions() {
        return { publicStorage: "granted" };
      }
      async checkPermissions() {
        return { publicStorage: "granted" };
      }
      /**
       * Function that can perform a copy or a rename
       * @param options the options for the rename operation
       * @param doRename whether to perform a rename or copy operation
       * @return a promise that resolves with the result
       */
      async _copy(options, doRename = false) {
        let { toDirectory } = options;
        const { to, from, directory: fromDirectory } = options;
        if (!to || !from) {
          throw Error("Both to and from must be provided");
        }
        if (!toDirectory) {
          toDirectory = fromDirectory;
        }
        const fromPath = this.getPath(fromDirectory, from);
        const toPath = this.getPath(toDirectory, to);
        if (fromPath === toPath) {
          return {
            uri: toPath
          };
        }
        if (isPathParent(fromPath, toPath)) {
          throw Error("To path cannot contain the from path");
        }
        let toObj;
        try {
          toObj = await this.stat({
            path: to,
            directory: toDirectory
          });
        } catch (e) {
          const toPathComponents = to.split("/");
          toPathComponents.pop();
          const toPath2 = toPathComponents.join("/");
          if (toPathComponents.length > 0) {
            const toParentDirectory = await this.stat({
              path: toPath2,
              directory: toDirectory
            });
            if (toParentDirectory.type !== "directory") {
              throw new Error("Parent directory of the to path is a file");
            }
          }
        }
        if (toObj && toObj.type === "directory") {
          throw new Error("Cannot overwrite a directory with a file");
        }
        const fromObj = await this.stat({
          path: from,
          directory: fromDirectory
        });
        const updateTime = async (path, ctime2, mtime) => {
          const fullPath = this.getPath(toDirectory, path);
          const entry = await this.dbRequest("get", [fullPath]);
          entry.ctime = ctime2;
          entry.mtime = mtime;
          await this.dbRequest("put", [entry]);
        };
        const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
        switch (fromObj.type) {
          // The "from" object is a file
          case "file": {
            const file = await this.readFile({
              path: from,
              directory: fromDirectory
            });
            if (doRename) {
              await this.deleteFile({
                path: from,
                directory: fromDirectory
              });
            }
            let encoding;
            if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
              encoding = Encoding.UTF8;
            }
            const writeResult = await this.writeFile({
              path: to,
              directory: toDirectory,
              data: file.data,
              encoding
            });
            if (doRename) {
              await updateTime(to, ctime, fromObj.mtime);
            }
            return writeResult;
          }
          case "directory": {
            if (toObj) {
              throw Error("Cannot move a directory over an existing object");
            }
            try {
              await this.mkdir({
                path: to,
                directory: toDirectory,
                recursive: false
              });
              if (doRename) {
                await updateTime(to, ctime, fromObj.mtime);
              }
            } catch (e) {
            }
            const contents = (await this.readdir({
              path: from,
              directory: fromDirectory
            })).files;
            for (const filename of contents) {
              await this._copy({
                from: `${from}/${filename.name}`,
                to: `${to}/${filename.name}`,
                directory: fromDirectory,
                toDirectory
              }, doRename);
            }
            if (doRename) {
              await this.rmdir({
                path: from,
                directory: fromDirectory
              });
            }
          }
        }
        return {
          uri: toPath
        };
      }
      isBase64String(str) {
        try {
          return btoa(atob(str)) == str;
        } catch (err) {
          return false;
        }
      }
    };
    FilesystemWeb._debug = true;
  }
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/share/dist/esm/web.js
var web_exports3 = {};
__export(web_exports3, {
  ShareWeb: () => ShareWeb
});
var ShareWeb;
var init_web3 = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/share/dist/esm/web.js"() {
    init_dist();
    ShareWeb = class extends WebPlugin {
      async canShare() {
        if (typeof navigator === "undefined" || !navigator.share) {
          return { value: false };
        } else {
          return { value: true };
        }
      }
      async share(options) {
        if (typeof navigator === "undefined" || !navigator.share) {
          throw this.unavailable("Share API not available in this browser");
        }
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url
        });
        return {};
      }
    };
  }
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/app/dist/esm/web.js
var web_exports4 = {};
__export(web_exports4, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web4 = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/app/dist/esm/web.js"() {
    init_dist();
    AppWeb = class extends WebPlugin {
      constructor() {
        super();
        this.handleVisibilityChange = () => {
          const data = {
            isActive: document.hidden !== true
          };
          this.notifyListeners("appStateChange", data);
          if (document.hidden) {
            this.notifyListeners("pause", null);
          } else {
            this.notifyListeners("resume", null);
          }
        };
        document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
      }
      exitApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getInfo() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getLaunchUrl() {
        return { url: "" };
      }
      async getState() {
        return { isActive: document.hidden !== true };
      }
      async minimizeApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async toggleBackButtonHandler() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getAppLanguage() {
        return {
          value: navigator.language.split("-")[0].toLowerCase()
        };
      }
    };
  }
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/privacy-screen/dist/web-CuWXBIfc.js
var web_CuWXBIfc_exports = {};
__export(web_CuWXBIfc_exports, {
  PrivacyScreenWeb: () => r
});
var r;
var init_web_CuWXBIfc = __esm({
  "../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/privacy-screen/dist/web-CuWXBIfc.js"() {
    init_dist();
    r = class extends WebPlugin {
      constructor() {
        super(...arguments), this.enabled = false;
      }
      async enable(s2) {
        return this.enabled = true, console.warn("Privacy Screen protection is not available on web platforms"), { success: false };
      }
      async disable() {
        return this.enabled = false, console.warn("Privacy Screen protection is not available on web platforms"), { success: true };
      }
      async isEnabled() {
        return {
          enabled: this.enabled
        };
      }
    };
  }
});

// src/bootstrap.mjs
init_dist();

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor-community/sqlite/dist/esm/index.js
init_dist();

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor-community/sqlite/dist/esm/definitions.js
var SQLiteConnection = class {
  constructor(sqlite) {
    this.sqlite = sqlite;
    this._connectionDict = /* @__PURE__ */ new Map();
  }
  async initWebStore() {
    try {
      await this.sqlite.initWebStore();
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async saveToStore(database) {
    try {
      await this.sqlite.saveToStore({ database });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async saveToLocalDisk(database) {
    try {
      await this.sqlite.saveToLocalDisk({ database });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getFromLocalDiskToStore(overwrite) {
    const mOverwrite = overwrite != null ? overwrite : true;
    try {
      await this.sqlite.getFromLocalDiskToStore({ overwrite: mOverwrite });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async echo(value) {
    try {
      const res = await this.sqlite.echo({ value });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isSecretStored() {
    try {
      const res = await this.sqlite.isSecretStored();
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async setEncryptionSecret(passphrase) {
    try {
      await this.sqlite.setEncryptionSecret({ passphrase });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async changeEncryptionSecret(passphrase, oldpassphrase) {
    try {
      await this.sqlite.changeEncryptionSecret({
        passphrase,
        oldpassphrase
      });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async clearEncryptionSecret() {
    try {
      await this.sqlite.clearEncryptionSecret();
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async checkEncryptionSecret(passphrase) {
    try {
      const res = await this.sqlite.checkEncryptionSecret({
        passphrase
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async addUpgradeStatement(database, upgrade) {
    try {
      if (database.endsWith(".db"))
        database = database.slice(0, -3);
      await this.sqlite.addUpgradeStatement({
        database,
        upgrade
      });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async createConnection(database, encrypted, mode, version, readonly) {
    try {
      if (database.endsWith(".db"))
        database = database.slice(0, -3);
      await this.sqlite.createConnection({
        database,
        encrypted,
        mode,
        version,
        readonly
      });
      const conn = new SQLiteDBConnection(database, readonly, this.sqlite);
      const connName = readonly ? `RO_${database}` : `RW_${database}`;
      this._connectionDict.set(connName, conn);
      return Promise.resolve(conn);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async closeConnection(database, readonly) {
    try {
      if (database.endsWith(".db"))
        database = database.slice(0, -3);
      await this.sqlite.closeConnection({ database, readonly });
      const connName = readonly ? `RO_${database}` : `RW_${database}`;
      this._connectionDict.delete(connName);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isConnection(database, readonly) {
    const res = {};
    if (database.endsWith(".db"))
      database = database.slice(0, -3);
    const connName = readonly ? `RO_${database}` : `RW_${database}`;
    res.result = this._connectionDict.has(connName);
    return Promise.resolve(res);
  }
  async retrieveConnection(database, readonly) {
    if (database.endsWith(".db"))
      database = database.slice(0, -3);
    const connName = readonly ? `RO_${database}` : `RW_${database}`;
    if (this._connectionDict.has(connName)) {
      const conn = this._connectionDict.get(connName);
      if (typeof conn != "undefined")
        return Promise.resolve(conn);
      else {
        return Promise.reject(`Connection ${database} is undefined`);
      }
    } else {
      return Promise.reject(`Connection ${database} does not exist`);
    }
  }
  async getNCDatabasePath(path, database) {
    try {
      const databasePath = await this.sqlite.getNCDatabasePath({
        path,
        database
      });
      return Promise.resolve(databasePath);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async createNCConnection(databasePath, version) {
    try {
      await this.sqlite.createNCConnection({
        databasePath,
        version
      });
      const conn = new SQLiteDBConnection(databasePath, true, this.sqlite);
      const connName = `RO_${databasePath})`;
      this._connectionDict.set(connName, conn);
      return Promise.resolve(conn);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async closeNCConnection(databasePath) {
    try {
      await this.sqlite.closeNCConnection({ databasePath });
      const connName = `RO_${databasePath})`;
      this._connectionDict.delete(connName);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isNCConnection(databasePath) {
    const res = {};
    const connName = `RO_${databasePath})`;
    res.result = this._connectionDict.has(connName);
    return Promise.resolve(res);
  }
  async retrieveNCConnection(databasePath) {
    if (this._connectionDict.has(databasePath)) {
      const connName = `RO_${databasePath})`;
      const conn = this._connectionDict.get(connName);
      if (typeof conn != "undefined")
        return Promise.resolve(conn);
      else {
        return Promise.reject(`Connection ${databasePath} is undefined`);
      }
    } else {
      return Promise.reject(`Connection ${databasePath} does not exist`);
    }
  }
  async isNCDatabase(databasePath) {
    try {
      const res = await this.sqlite.isNCDatabase({ databasePath });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async retrieveAllConnections() {
    return this._connectionDict;
  }
  async closeAllConnections() {
    const delDict = /* @__PURE__ */ new Map();
    try {
      for (const key of this._connectionDict.keys()) {
        const database = key.substring(3);
        const readonly = key.substring(0, 3) === "RO_" ? true : false;
        await this.sqlite.closeConnection({ database, readonly });
        delDict.set(key, null);
      }
      for (const key of delDict.keys()) {
        this._connectionDict.delete(key);
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async checkConnectionsConsistency() {
    try {
      const keys = [...this._connectionDict.keys()];
      const openModes = [];
      const dbNames = [];
      for (const key of keys) {
        openModes.push(key.substring(0, 2));
        dbNames.push(key.substring(3));
      }
      const res = await this.sqlite.checkConnectionsConsistency({
        dbNames,
        openModes
      });
      if (!res.result)
        this._connectionDict = /* @__PURE__ */ new Map();
      return Promise.resolve(res);
    } catch (err) {
      this._connectionDict = /* @__PURE__ */ new Map();
      return Promise.reject(err);
    }
  }
  async importFromJson(jsonstring) {
    try {
      const ret = await this.sqlite.importFromJson({ jsonstring });
      return Promise.resolve(ret);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isJsonValid(jsonstring) {
    try {
      const ret = await this.sqlite.isJsonValid({ jsonstring });
      return Promise.resolve(ret);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async copyFromAssets(overwrite) {
    const mOverwrite = overwrite != null ? overwrite : true;
    try {
      await this.sqlite.copyFromAssets({ overwrite: mOverwrite });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getFromHTTPRequest(url, overwrite) {
    const mOverwrite = overwrite != null ? overwrite : true;
    try {
      await this.sqlite.getFromHTTPRequest({ url, overwrite: mOverwrite });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isDatabaseEncrypted(database) {
    if (database.endsWith(".db"))
      database = database.slice(0, -3);
    try {
      const res = await this.sqlite.isDatabaseEncrypted({ database });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isInConfigEncryption() {
    try {
      const res = await this.sqlite.isInConfigEncryption();
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isInConfigBiometricAuth() {
    try {
      const res = await this.sqlite.isInConfigBiometricAuth();
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isDatabase(database) {
    if (database.endsWith(".db"))
      database = database.slice(0, -3);
    try {
      const res = await this.sqlite.isDatabase({ database });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getDatabaseList() {
    try {
      const res = await this.sqlite.getDatabaseList();
      const values = res.values;
      values.sort();
      const ret = { values };
      return Promise.resolve(ret);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getMigratableDbList(folderPath) {
    const path = folderPath ? folderPath : "default";
    try {
      const res = await this.sqlite.getMigratableDbList({
        folderPath: path
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async addSQLiteSuffix(folderPath, dbNameList) {
    const path = folderPath ? folderPath : "default";
    const dbList = dbNameList ? dbNameList : [];
    try {
      const res = await this.sqlite.addSQLiteSuffix({
        folderPath: path,
        dbNameList: dbList
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async deleteOldDatabases(folderPath, dbNameList) {
    const path = folderPath ? folderPath : "default";
    const dbList = dbNameList ? dbNameList : [];
    try {
      const res = await this.sqlite.deleteOldDatabases({
        folderPath: path,
        dbNameList: dbList
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async moveDatabasesAndAddSuffix(folderPath, dbNameList) {
    const path = folderPath ? folderPath : "default";
    const dbList = dbNameList ? dbNameList : [];
    return this.sqlite.moveDatabasesAndAddSuffix({
      folderPath: path,
      dbNameList: dbList
    });
  }
};
var SQLiteDBConnection = class {
  constructor(dbName, readonly, sqlite) {
    this.dbName = dbName;
    this.readonly = readonly;
    this.sqlite = sqlite;
  }
  getConnectionDBName() {
    return this.dbName;
  }
  getConnectionReadOnly() {
    return this.readonly;
  }
  async open() {
    try {
      await this.sqlite.open({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async close() {
    try {
      await this.sqlite.close({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async beginTransaction() {
    try {
      const changes = await this.sqlite.beginTransaction({
        database: this.dbName
      });
      return Promise.resolve(changes);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async commitTransaction() {
    try {
      const changes = await this.sqlite.commitTransaction({
        database: this.dbName
      });
      return Promise.resolve(changes);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async rollbackTransaction() {
    try {
      const changes = await this.sqlite.rollbackTransaction({
        database: this.dbName
      });
      return Promise.resolve(changes);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isTransactionActive() {
    try {
      const result = await this.sqlite.isTransactionActive({
        database: this.dbName
      });
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async loadExtension(path) {
    try {
      await this.sqlite.loadExtension({
        database: this.dbName,
        path,
        readonly: this.readonly
      });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async enableLoadExtension(toggle) {
    try {
      await this.sqlite.enableLoadExtension({
        database: this.dbName,
        toggle,
        readonly: this.readonly
      });
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getUrl() {
    try {
      const res = await this.sqlite.getUrl({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getVersion() {
    try {
      const version = await this.sqlite.getVersion({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve(version);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getTableList() {
    try {
      const res = await this.sqlite.getTableList({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async execute(statements, transaction = true, isSQL92 = true) {
    try {
      if (!this.readonly) {
        const res = await this.sqlite.execute({
          database: this.dbName,
          statements,
          transaction,
          readonly: false,
          isSQL92
        });
        return Promise.resolve(res);
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async query(statement, values, isSQL92 = true) {
    let res;
    try {
      if (values && values.length > 0) {
        res = await this.sqlite.query({
          database: this.dbName,
          statement,
          values,
          readonly: this.readonly,
          isSQL92: true
        });
      } else {
        res = await this.sqlite.query({
          database: this.dbName,
          statement,
          values: [],
          readonly: this.readonly,
          isSQL92
        });
      }
      res = await this.reorderRows(res);
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async run(statement, values, transaction = true, returnMode = "no", isSQL92 = true) {
    let res;
    try {
      if (!this.readonly) {
        if (values && values.length > 0) {
          res = await this.sqlite.run({
            database: this.dbName,
            statement,
            values,
            transaction,
            readonly: false,
            returnMode,
            isSQL92: true
          });
        } else {
          res = await this.sqlite.run({
            database: this.dbName,
            statement,
            values: [],
            transaction,
            readonly: false,
            returnMode,
            isSQL92
          });
        }
        res.changes = await this.reorderRows(res.changes);
        return Promise.resolve(res);
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async executeSet(set, transaction = true, returnMode = "no", isSQL92 = true) {
    let res;
    try {
      if (!this.readonly) {
        res = await this.sqlite.executeSet({
          database: this.dbName,
          set,
          transaction,
          readonly: false,
          returnMode,
          isSQL92
        });
        res.changes = await this.reorderRows(res.changes);
        return Promise.resolve(res);
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isExists() {
    try {
      const res = await this.sqlite.isDBExists({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isTable(table) {
    try {
      const res = await this.sqlite.isTableExists({
        database: this.dbName,
        table,
        readonly: this.readonly
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async isDBOpen() {
    try {
      const res = await this.sqlite.isDBOpen({
        database: this.dbName,
        readonly: this.readonly
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async delete() {
    try {
      if (!this.readonly) {
        await this.sqlite.deleteDatabase({
          database: this.dbName,
          readonly: false
        });
        return Promise.resolve();
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async createSyncTable() {
    try {
      if (!this.readonly) {
        const res = await this.sqlite.createSyncTable({
          database: this.dbName,
          readonly: false
        });
        return Promise.resolve(res);
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async setSyncDate(syncdate) {
    try {
      if (!this.readonly) {
        await this.sqlite.setSyncDate({
          database: this.dbName,
          syncdate,
          readonly: false
        });
        return Promise.resolve();
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async getSyncDate() {
    try {
      const res = await this.sqlite.getSyncDate({
        database: this.dbName,
        readonly: this.readonly
      });
      let retDate = "";
      if (res.syncDate > 0)
        retDate = new Date(res.syncDate * 1e3).toISOString();
      return Promise.resolve(retDate);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async exportToJson(mode, encrypted = false) {
    try {
      const res = await this.sqlite.exportToJson({
        database: this.dbName,
        jsonexportmode: mode,
        readonly: this.readonly,
        encrypted
      });
      return Promise.resolve(res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async deleteExportedRows() {
    try {
      if (!this.readonly) {
        await this.sqlite.deleteExportedRows({
          database: this.dbName,
          readonly: false
        });
        return Promise.resolve();
      } else {
        return Promise.reject("not allowed in read-only mode");
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
  async executeTransaction(txn, isSQL92 = true) {
    let changes = 0;
    let isActive = false;
    if (!this.readonly) {
      await this.sqlite.beginTransaction({
        database: this.dbName
      });
      isActive = await this.sqlite.isTransactionActive({
        database: this.dbName
      });
      if (!isActive) {
        return Promise.reject("After Begin Transaction, no transaction active");
      }
      try {
        for (const task of txn) {
          if (typeof task !== "object" || !("statement" in task)) {
            throw new Error("Error a task.statement must be provided");
          }
          if ("values" in task && task.values && task.values.length > 0) {
            const retMode = task.statement.toUpperCase().includes("RETURNING") ? "all" : "no";
            const ret = await this.sqlite.run({
              database: this.dbName,
              statement: task.statement,
              values: task.values,
              transaction: false,
              readonly: false,
              returnMode: retMode,
              isSQL92
            });
            if (ret.changes.changes < 0) {
              throw new Error("Error in transaction method run ");
            }
            changes += ret.changes.changes;
          } else {
            const ret = await this.sqlite.execute({
              database: this.dbName,
              statements: task.statement,
              transaction: false,
              readonly: false
            });
            if (ret.changes.changes < 0) {
              throw new Error("Error in transaction method execute ");
            }
            changes += ret.changes.changes;
          }
        }
        const retC = await this.sqlite.commitTransaction({
          database: this.dbName
        });
        changes += retC.changes.changes;
        const retChanges = { changes: { changes } };
        return Promise.resolve(retChanges);
      } catch (err) {
        const msg = err.message ? err.message : err;
        await this.sqlite.rollbackTransaction({
          database: this.dbName
        });
        return Promise.reject(msg);
      }
    } else {
      return Promise.reject("not allowed in read-only mode");
    }
  }
  async reorderRows(res) {
    const retRes = res;
    if (res?.values && typeof res.values[0] === "object") {
      if (Object.keys(res.values[0]).includes("ios_columns")) {
        const columnList = res.values[0]["ios_columns"];
        const iosRes = [];
        for (let i2 = 1; i2 < res.values.length; i2++) {
          const rowJson = res.values[i2];
          const resRowJson = {};
          for (const item of columnList) {
            resRowJson[item] = rowJson[item];
          }
          iosRes.push(resRowJson);
        }
        retRes["values"] = iosRes;
      }
    }
    return Promise.resolve(retRes);
  }
};

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor-community/sqlite/dist/esm/index.js
var CapacitorSQLite = registerPlugin("CapacitorSQLite", {
  web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.CapacitorSQLiteWeb()),
  electron: () => window.CapacitorCustomPlatform.plugins.CapacitorSQLite
});

// src/snapshot-store.mjs
var STATE_KEY = "salarymate_v310_state";
var CREATE_SQL = `CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;
function validateSnapshot(text) {
  const value = JSON.parse(text);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Invalid backup");
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > 13) throw new Error("Unsupported schema");
  for (const field of ["companies", "records", "overtimeLogs"]) {
    if (!Array.isArray(value[field])) throw new Error(`Missing ${field}`);
  }
  for (const field of ["leaveRecords", "salaryAdjustments", "yearEndEstimates"]) {
    if (value[field] !== void 0 && !Array.isArray(value[field])) throw new Error(`Invalid ${field}`);
  }
  return value;
}
var SnapshotRepository = class {
  constructor(db) {
    this.db = db;
  }
  async open() {
    await this.db.execute(CREATE_SQL);
  }
  async read() {
    const result = await this.db.query("SELECT payload FROM snapshots ORDER BY id DESC LIMIT 1;");
    const payload = result.values?.[0]?.payload ?? null;
    if (payload !== null) validateSnapshot(payload);
    return payload;
  }
  async list() {
    const result = await this.db.query("SELECT id, payload, created_at FROM snapshots ORDER BY id DESC LIMIT 3;");
    return (result.values || []).map((row) => {
      try {
        return { ...row, valid: true, summary: snapshotSummary(row.payload) };
      } catch {
        return { id: row.id, created_at: row.created_at, valid: false };
      }
    });
  }
  async write(payload, reset = false) {
    validateSnapshot(payload);
    await this.db.executeSet([
      ...reset ? [{ statement: "DELETE FROM snapshots;", values: [] }] : [],
      { statement: "INSERT INTO snapshots (payload, created_at) VALUES (?, ?);", values: [payload, (/* @__PURE__ */ new Date()).toISOString()] },
      { statement: "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 3);", values: [] }
    ], true);
  }
};
function snapshotSummary(payload) {
  const data = validateSnapshot(payload);
  return ["companies", "records", "overtimeLogs", "leaveRecords", "salaryAdjustments", "yearEndEstimates"].map((key, i2) => `${["\u516C\u53F8", "\u85AA\u8CC7", "\u52A0\u73ED", "\u8ACB\u5047", "\u8ABF\u85AA", "\u5E74\u7D42"][i2]} ${data[key]?.length || 0} \u7B46`).join("\u3001");
}
async function createNativeStore(repository2, legacy, onStatus = () => {
}) {
  await repository2.open();
  let value = await repository2.read();
  if (value === null) {
    const old = legacy.getItem(STATE_KEY);
    if (old !== null) {
      validateSnapshot(old);
      await repository2.write(old);
      value = old;
      if (await repository2.read() !== old) throw new Error("Migration verification failed");
    }
  }
  let tail = Promise.resolve();
  let failed = null;
  let pending = 0;
  return Object.freeze({
    getItem(key) {
      return key === STATE_KEY ? value : legacy.getItem(key);
    },
    setItem(key, text, reset = false) {
      if (key !== STATE_KEY) throw new Error("Unsupported storage key");
      if (failed) throw failed;
      validateSnapshot(text);
      value = text;
      pending++;
      onStatus("pending");
      tail = tail.then(async () => {
        if (failed) throw failed;
        await repository2.write(text, reset);
        if (reset) {
          for (const oldKey of [STATE_KEY, "my_salary_records_v2", "my_salary_companies_v2", "my_salary_overtime_v2", "my_salary_hourly_settings_v2"]) legacy.removeItem(oldKey);
        }
        pending--;
        if (!pending) onStatus("saved");
      }).catch((error) => {
        failed = error;
        onStatus("failed");
        throw error;
      });
      tail.catch(() => {
      });
    },
    flush() {
      return tail;
    }
  });
}

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/filesystem/dist/esm/index.js
init_dist();

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/synapse/dist/synapse.mjs
function s(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, n) {
        return new Proxy({}, {
          get(w, o) {
            return (c, p, r2) => {
              const i2 = t.Capacitor.Plugins[n];
              if (i2 === void 0) {
                r2(new Error(`Capacitor plugin ${n} not found`));
                return;
              }
              if (typeof i2[o] != "function") {
                r2(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
                return;
              }
              (async () => {
                try {
                  const a = await i2[o](c);
                  p(a);
                } catch (a) {
                  r2(a);
                }
              })();
            };
          }
        });
      }
    }
  );
}
function u(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, n) {
        return t.cordova.plugins[n];
      }
    }
  );
}
function f(t = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window));
}

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/filesystem/dist/esm/index.js
init_definitions();
var Filesystem = registerPlugin("Filesystem", {
  web: () => Promise.resolve().then(() => (init_web2(), web_exports2)).then((m) => new m.FilesystemWeb())
});
f();

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/share/dist/esm/index.js
init_dist();
var Share = registerPlugin("Share", {
  web: () => Promise.resolve().then(() => (init_web3(), web_exports3)).then((m) => new m.ShareWeb())
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web4(), web_exports4)).then((m) => new m.AppWeb())
});

// ../SalaryMate_v4.3.1_Full_Build_Kit_R4/formal-source/node_modules/@capacitor/privacy-screen/dist/plugin.mjs
init_dist();
var i = registerPlugin("PrivacyScreen", {
  web: () => Promise.resolve().then(() => (init_web_CuWXBIfc(), web_CuWXBIfc_exports)).then((e) => new e.PrivacyScreenWeb())
});

// src/backup-crypto.mjs
var FORMAT = "salarymate-encrypted-backup";
var VERSION = 1;
var ITERATIONS = 31e4;
var MIN_ITERATIONS = 1e5;
var MAX_ITERATIONS = 1e6;
var MIN_PASSWORD_LENGTH = 12;
var MAX_PLAINTEXT_BYTES = 20 * 1024 * 1024;
var MAX_CIPHERTEXT_BYTES = 28 * 1024 * 1024;
var AAD = "SalaryMate|encrypted-backup|v1";
var BackupCryptoError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackupCryptoError";
    this.code = code;
  }
};
function requireCrypto(api) {
  if (!api?.subtle || typeof api.getRandomValues !== "function") {
    throw new BackupCryptoError("CRYPTO_UNAVAILABLE", "\u6B64\u88DD\u7F6E\u4E0D\u652F\u63F4\u5B89\u5168\u5099\u4EFD\u52A0\u5BC6");
  }
  return api;
}
function normalizePassword(password, enforceMinimum = false) {
  const value = String(password ?? "").normalize("NFC");
  if (!value) throw new BackupCryptoError("PASSWORD_REQUIRED", "\u8ACB\u8F38\u5165\u5099\u4EFD\u5BC6\u78BC");
  if (enforceMinimum && [...value].length < MIN_PASSWORD_LENGTH) {
    throw new BackupCryptoError("PASSWORD_TOO_SHORT", `\u5099\u4EFD\u5BC6\u78BC\u81F3\u5C11\u9700\u8981 ${MIN_PASSWORD_LENGTH} \u500B\u5B57\u5143`);
  }
  return value;
}
function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return globalThis.btoa(binary);
}
function base64ToBytes(value, label) {
  if (typeof value !== "string" || !value.length || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new BackupCryptoError("INVALID_FORMAT", `${label} \u683C\u5F0F\u932F\u8AA4`);
  }
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new BackupCryptoError("INVALID_FORMAT", `${label} \u683C\u5F0F\u932F\u8AA4`);
  }
}
function parseEnvelope(text) {
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new BackupCryptoError("INVALID_FORMAT", "\u4E0D\u662F\u6709\u6548\u7684\u52A0\u5BC6\u5099\u4EFD");
  }
  if (!envelope || Array.isArray(envelope) || typeof envelope !== "object" || envelope.format !== FORMAT) {
    throw new BackupCryptoError("INVALID_FORMAT", "\u4E0D\u662F\u500B\u4EBA\u85AA\u8CC7\u7BA1\u7406\u52A0\u5BC6\u5099\u4EFD");
  }
  if (envelope.version !== VERSION) {
    throw new BackupCryptoError("UNSUPPORTED_VERSION", "\u6B64\u52A0\u5BC6\u5099\u4EFD\u7248\u672C\u5C1A\u4E0D\u652F\u63F4");
  }
  if (envelope.kdf?.name !== "PBKDF2" || envelope.kdf?.hash !== "SHA-256" || !Number.isInteger(envelope.kdf?.iterations) || envelope.kdf.iterations < MIN_ITERATIONS || envelope.kdf.iterations > MAX_ITERATIONS || envelope.cipher?.name !== "AES-GCM" || envelope.cipher?.tagLength !== 128) {
    throw new BackupCryptoError("INVALID_FORMAT", "\u52A0\u5BC6\u53C3\u6578\u4E0D\u53D7\u652F\u63F4");
  }
  const salt = base64ToBytes(envelope.kdf.salt, "Salt");
  const iv = base64ToBytes(envelope.cipher.iv, "IV");
  const ciphertext = base64ToBytes(envelope.payload, "Payload");
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17 || ciphertext.length > MAX_CIPHERTEXT_BYTES) {
    throw new BackupCryptoError("INVALID_FORMAT", "\u52A0\u5BC6\u5099\u4EFD\u5927\u5C0F\u6216\u53C3\u6578\u932F\u8AA4");
  }
  return { envelope, salt, iv, ciphertext };
}
async function deriveKey(password, salt, iterations, api) {
  const encoder = new TextEncoder();
  const material = await api.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return api.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
function isEncryptedBackup(text) {
  try {
    const value = JSON.parse(text);
    return Boolean(value && !Array.isArray(value) && value.format === FORMAT);
  } catch {
    return false;
  }
}
function inspectEncryptedBackup(text) {
  const { envelope } = parseEnvelope(text);
  return Object.freeze({ format: envelope.format, version: envelope.version, createdAt: envelope.createdAt || null });
}
async function encryptBackup(payload, password, cryptoApi = globalThis.crypto) {
  const api = requireCrypto(cryptoApi);
  const normalizedPassword = normalizePassword(password, true);
  const plaintext = new TextEncoder().encode(String(payload));
  if (!plaintext.length || plaintext.length > MAX_PLAINTEXT_BYTES) {
    throw new BackupCryptoError("PAYLOAD_TOO_LARGE", "\u5099\u4EFD\u5167\u5BB9\u70BA\u7A7A\u6216\u8D85\u904E 20 MB");
  }
  const salt = api.getRandomValues(new Uint8Array(16));
  const iv = api.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(normalizedPassword, salt, ITERATIONS, api);
  const encrypted = new Uint8Array(await api.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(AAD), tagLength: 128 },
    key,
    plaintext
  ));
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: "AES-GCM", iv: bytesToBase64(iv), tagLength: 128 },
    payload: bytesToBase64(encrypted)
  });
}
async function decryptBackup(text, password, cryptoApi = globalThis.crypto) {
  const api = requireCrypto(cryptoApi);
  const normalizedPassword = normalizePassword(password);
  const { envelope, salt, iv, ciphertext } = parseEnvelope(text);
  try {
    const key = await deriveKey(normalizedPassword, salt, envelope.kdf.iterations, api);
    const plaintext = new Uint8Array(await api.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(AAD), tagLength: 128 },
      key,
      ciphertext
    ));
    if (!plaintext.length || plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error("Invalid plaintext size");
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch (error) {
    if (error instanceof BackupCryptoError) throw error;
    throw new BackupCryptoError("AUTH_FAILED", "\u5BC6\u78BC\u932F\u8AA4\uFF0C\u6216\u5099\u4EFD\u6A94\u6848\u5DF2\u640D\u58DE");
  }
}
var BACKUP_CRYPTO_LIMITS = Object.freeze({
  minimumPasswordLength: MIN_PASSWORD_LENGTH,
  maximumPlaintextBytes: MAX_PLAINTEXT_BYTES,
  maximumEncryptedBytes: MAX_CIPHERTEXT_BYTES
});

// src/native-backup.mjs
function createBackupService(filesystem, share, directory, encoding, version = "4.3.2-RC.3", crypto = { encryptBackup, decryptBackup, inspectEncryptedBackup, isEncryptedBackup }, fileSaver) {
  let busy = false;
  const fileName = () => `SalaryMate_v${version}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.salarymate`;
  const prepare = async (payload, password) => {
    validateSnapshot(payload);
    const encrypted = await crypto.encryptBackup(payload, password);
    const verifiedPayload = await crypto.decryptBackup(encrypted, password);
    if (verifiedPayload !== payload) throw new Error("\u5099\u4EFD\u89E3\u5BC6\u9A57\u8B49\u5931\u6557");
    return encrypted;
  };
  const exclusive = async (action) => {
    if (busy) throw new Error("\u5099\u4EFD\u6B63\u5728\u9032\u884C\u4E2D");
    busy = true;
    try {
      return await action();
    } finally {
      busy = false;
    }
  };
  return Object.freeze({
    isEncrypted: crypto.isEncryptedBackup,
    inspect: crypto.inspectEncryptedBackup,
    async decrypt(text, password) {
      const payload = await crypto.decryptBackup(text, password);
      validateSnapshot(payload);
      return payload;
    },
    async saveEncrypted(payload, password) {
      return exclusive(async () => {
        if (!fileSaver?.save) {
          const error = new Error("\u6B64\u88DD\u7F6E\u7121\u6CD5\u958B\u555F\u5B89\u5168\u53E6\u5B58\u529F\u80FD");
          error.code = "SAVE_UNAVAILABLE";
          throw error;
        }
        const encrypted = await prepare(payload, password);
        const suggestedName = fileName();
        const result = await fileSaver.save({
          fileName: suggestedName,
          data: encrypted,
          mimeType: "application/octet-stream"
        });
        const savedName = String(result?.fileName || suggestedName);
        if (!savedName.toLowerCase().endsWith(".salarymate")) {
          const error = new Error("\u5132\u5B58\u4F4D\u7F6E\u672A\u4FDD\u7559 .salarymate \u526F\u6A94\u540D");
          error.code = "SAVE_EXTENSION_CHANGED";
          throw error;
        }
        return { fileName: savedName };
      });
    },
    async shareEncrypted(payload, password) {
      return exclusive(async () => {
        const encrypted = await prepare(payload, password);
        const path = fileName();
        await filesystem.writeFile({ path, data: encrypted, directory, encoding });
        const verified = await filesystem.readFile({ path, directory, encoding });
        if (verified.data !== encrypted) throw new Error("\u5099\u4EFD\u5BEB\u5165\u9A57\u8B49\u5931\u6557");
        const { uri } = await filesystem.getUri({ path, directory });
        await share.share({
          title: path,
          files: [uri],
          dialogTitle: "\u5206\u4EAB\u52A0\u5BC6\u85AA\u8CC7\u5099\u4EFD"
        });
        return { fileName: path };
      });
    }
  });
}

// src/backup-import.mjs
function inspectBackupCandidate(fileName, text, backup2) {
  const safeName = String(fileName || "\u672A\u547D\u540D\u5099\u4EFD");
  if (backup2.isEncrypted(text)) {
    backup2.inspect(text);
    return Object.freeze({ kind: "encrypted", fileName: safeName });
  }
  return Object.freeze({
    kind: "legacy-json",
    fileName: safeName,
    summary: snapshotSummary(text)
  });
}

// src/data-center.mjs
var MAX_IMPORT_BYTES = 30 * 1024 * 1024;
function friendlyError(error) {
  const messages = {
    PASSWORD_REQUIRED: "\u8ACB\u8F38\u5165\u5099\u4EFD\u5BC6\u78BC\u3002",
    PASSWORD_TOO_SHORT: "\u65B0\u5099\u4EFD\u5BC6\u78BC\u81F3\u5C11\u9700\u8981 12 \u500B\u5B57\u5143\u3002",
    AUTH_FAILED: "\u5BC6\u78BC\u932F\u8AA4\uFF0C\u6216\u5099\u4EFD\u6A94\u6848\u5DF2\u640D\u58DE\u3002\u539F\u8CC7\u6599\u672A\u8B8A\u66F4\u3002",
    INVALID_FORMAT: "\u5099\u4EFD\u683C\u5F0F\u932F\u8AA4\u6216\u6A94\u6848\u5DF2\u640D\u58DE\u3002\u539F\u8CC7\u6599\u672A\u8B8A\u66F4\u3002",
    UNSUPPORTED_VERSION: "\u6B64\u52A0\u5BC6\u5099\u4EFD\u7248\u672C\u5C1A\u672A\u652F\u63F4\u3002",
    CRYPTO_UNAVAILABLE: "\u6B64\u88DD\u7F6E\u7121\u6CD5\u5EFA\u7ACB\u5B89\u5168\u52A0\u5BC6\u5099\u4EFD\u3002",
    AUTH_CANCELLED: "\u88DD\u7F6E\u9A57\u8B49\u5DF2\u53D6\u6D88\uFF0C\u8A2D\u5B9A\u672A\u8B8A\u66F4\u3002",
    AUTH_UNAVAILABLE: "\u8ACB\u5148\u5728\u88DD\u7F6E\u8A2D\u5B9A\u555F\u7528\u87A2\u5E55\u9396\u6216\u751F\u7269\u8FA8\u8B58\u3002",
    SAVE_CANCELLED: "\u5DF2\u53D6\u6D88\u53E6\u5B58\u5099\u4EFD\uFF0C\u539F\u8CC7\u6599\u672A\u8B8A\u66F4\u3002",
    SAVE_UNAVAILABLE: "\u6B64\u88DD\u7F6E\u7121\u6CD5\u958B\u555F\u5B89\u5168\u53E6\u5B58\u529F\u80FD\uFF0C\u8ACB\u6539\u7528\u7CFB\u7D71\u5206\u4EAB\u3002",
    SAVE_EXTENSION_CHANGED: "\u5132\u5B58\u4F4D\u7F6E\u672A\u4FDD\u7559 .salarymate \u526F\u6A94\u540D\uFF0C\u8ACB\u91CD\u65B0\u53E6\u5B58\u4E26\u4FDD\u7559\u5B8C\u6574\u6A94\u540D\u3002",
    SAVE_FAILED: "\u5099\u4EFD\u672A\u80FD\u5B8C\u6574\u5BEB\u5165\uFF0C\u8ACB\u66F4\u63DB\u5132\u5B58\u4F4D\u7F6E\u5F8C\u91CD\u8A66\u3002"
  };
  if (messages[error?.code]) return messages[error.code];
  const detail = String(error?.message || "");
  return /[\u3400-\u9fff]/.test(detail) ? detail : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u539F\u8CC7\u6599\u672A\u8B8A\u66F4\u3002\u8ACB\u78BA\u8A8D\u6A94\u6848\u5F8C\u91CD\u8A66\u3002";
}
function createPasswordForm(panel, { title, confirmPassword, submitLabel, onSubmit }) {
  panel.replaceChildren();
  const form = document.createElement("form");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const passwordLabel = document.createElement("label");
  passwordLabel.textContent = confirmPassword ? "\u8A2D\u5B9A\u5099\u4EFD\u5BC6\u78BC\uFF08\u81F3\u5C11 12 \u500B\u5B57\u5143\uFF09" : "\u8F38\u5165\u6B64\u5099\u4EFD\u7684\u5BC6\u78BC";
  const password = document.createElement("input");
  password.className = "field";
  password.type = "password";
  password.required = true;
  password.autocomplete = confirmPassword ? "new-password" : "current-password";
  passwordLabel.append(password);
  form.append(heading, passwordLabel);
  let confirmation;
  if (confirmPassword) {
    const confirmationLabel = document.createElement("label");
    confirmationLabel.textContent = "\u518D\u6B21\u8F38\u5165\u5099\u4EFD\u5BC6\u78BC";
    confirmation = document.createElement("input");
    confirmation.className = "field";
    confirmation.type = "password";
    confirmation.required = true;
    confirmation.autocomplete = "new-password";
    confirmationLabel.append(confirmation);
    form.append(confirmationLabel);
  }
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  const actions = document.createElement("div");
  actions.className = "form-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn";
  cancel.textContent = "\u53D6\u6D88";
  cancel.addEventListener("click", () => {
    password.value = "";
    if (confirmation) confirmation.value = "";
    panel.replaceChildren();
  });
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.textContent = submitLabel;
  actions.append(cancel, submit);
  form.append(error, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    if (confirmation && password.value !== confirmation.value) {
      error.textContent = "\u5169\u6B21\u8F38\u5165\u7684\u5099\u4EFD\u5BC6\u78BC\u4E0D\u4E00\u81F4\u3002";
      return;
    }
    submit.disabled = true;
    cancel.disabled = true;
    try {
      await onSubmit(password.value);
      password.value = "";
      if (confirmation) confirmation.value = "";
      panel.replaceChildren();
    } catch (caught) {
      error.textContent = friendlyError(caught);
      password.select();
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });
  panel.append(form);
  password.focus({ preventScroll: true });
}
function openDataCenter({ repository: repository2, backup: backup2, app, security: security2, nativeCopy: nativeCopy2, recovery = false }) {
  if (document.querySelector("dialog.data-center")) return;
  const dialog = document.createElement("dialog");
  dialog.className = "data-center";
  const heading = document.createElement("h2");
  heading.textContent = recovery ? "\u4FDD\u8B77\u5FEB\u7167\u6551\u63F4" : "\u8CC7\u6599\u4FDD\u8B77\u8207\u5099\u4EFD";
  const note = document.createElement("p");
  note.textContent = "\u7DB2\u7AD9\u3001R7 \u958B\u767C\u7248\u8207\u5176\u4ED6\u5B89\u88DD\u8EAB\u5206\u4E0D\u6703\u81EA\u52D5\u540C\u6B65\u3002\u8DE8 App \u8EAB\u5206\u79FB\u8F49\u6642\uFF0C\u8ACB\u5148\u5EFA\u7ACB\u52A0\u5BC6 .salarymate\uFF0C\u518D\u65BC\u672C\u7248\u6838\u5C0D\u6458\u8981\u5F8C\u9084\u539F\uFF1B\u540C\u4E00 App \u8EAB\u5206\u8986\u84CB\u66F4\u65B0\u5247\u4FDD\u7559\u539F\u8CC7\u6599\u3002";
  const privacy = document.createElement("p");
  privacy.textContent = "\u5099\u4EFD\u5BC6\u78BC\u4E0D\u6703\u5132\u5B58\u5728 App\uFF0C\u4E5F\u7121\u6CD5\u4EE3\u70BA\u627E\u56DE\u3002\u8ACB\u5C07\u5BC6\u78BC\u8207 .salarymate \u5099\u4EFD\u6A94\u5206\u958B\u4FDD\u7BA1\u3002App \u5167\u4FDD\u8B77\u5FEB\u7167\u6700\u591A\u4E09\u4EFD\uFF0C\u4E0D\u7B49\u540C\u5916\u90E8\u5099\u4EFD\u3002";
  const privacyDetails = document.createElement("details");
  const privacySummary = document.createElement("summary");
  privacySummary.textContent = "\u96B1\u79C1\u8207\u8CC7\u6599\u8655\u7406\u8AAA\u660E";
  const privacyCopy = document.createElement("p");
  privacyCopy.textContent = "\u85AA\u8CC7\u8CC7\u6599\u53EA\u5728\u6B64\u88DD\u7F6E\u672C\u6A5F\u8655\u7406\uFF1BApp \u4E0D\u5EFA\u7ACB\u5E33\u865F\u3001\u4E0D\u542B\u5EE3\u544A\u6216\u5206\u6790\u8FFD\u8E64\uFF0C\u4E5F\u4E0D\u6703\u81EA\u52D5\u4E0A\u50B3\u8CC7\u6599\u3002\u53EA\u6709\u60A8\u4E3B\u52D5\u53E6\u5B58\u3001\u5206\u4EAB\u6216\u532F\u5165\u5099\u4EFD\u6642\uFF0C\u8CC7\u6599\u624D\u6703\u4EA4\u7D66\u6240\u9078\u7684\u6A94\u6848\u6216\u5206\u4EAB\u670D\u52D9\u3002";
  privacyDetails.append(privacySummary, privacyCopy);
  const message = document.createElement("p");
  message.className = "data-center-message";
  message.setAttribute("role", "status");
  const list = document.createElement("div");
  const passwordPanel = document.createElement("div");
  passwordPanel.className = "password-panel";
  const fileActions = document.createElement("div");
  const button = (label, fn, className = "btn") => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    node.addEventListener("click", async () => {
      node.disabled = true;
      try {
        await fn();
      } catch (error) {
        message.textContent = friendlyError(error);
      } finally {
        node.disabled = false;
      }
    });
    return node;
  };
  const close = () => {
    if (dialog.open) dialog.close();
    else dialog.remove();
  };
  const apply = async (payload) => {
    validateSnapshot(payload);
    if (!recovery) {
      if (document.querySelector("#appDialog")?.open) throw new Error("\u8ACB\u5148\u95DC\u9589\u7DE8\u8F2F\u8996\u7A97");
      await window.SalaryMateStorage.flush?.();
      close();
      await app.importPayload(payload);
    } else {
      if (!window.confirm(`\u9084\u539F\u6703\u53D6\u4EE3\u76EE\u524D\u4F7F\u7528\u7684\u8CC7\u6599\u3002
${snapshotSummary(payload)}
\u78BA\u8A8D\u4F7F\u7528\u6B64\u5099\u4EFD\uFF1F`)) return;
      await repository2.write(payload);
      if (await repository2.read() !== payload) throw new Error("\u9084\u539F\u5F8C\u9A57\u8B49\u5931\u6557");
      window.location.reload();
    }
  };
  const newPassword = (title, payload, mode = "save") => createPasswordForm(passwordPanel, {
    title,
    confirmPassword: true,
    submitLabel: mode === "save" ? "\u52A0\u5BC6\u4E26\u9078\u64C7\u5132\u5B58\u4F4D\u7F6E" : "\u5EFA\u7ACB\u4E26\u958B\u555F\u7CFB\u7D71\u5206\u4EAB",
    onSubmit: async (password) => {
      await window.SalaryMateStorage.flush?.();
      if (mode === "save") {
        const result = await backup2.saveEncrypted(payload, password);
        message.textContent = `\u5DF2\u5B89\u5168\u5132\u5B58\u300C${result.fileName}\u300D\uFF0C\u4E26\u5B8C\u6210\u5BEB\u5165\u9A57\u8B49\u3002`;
      } else {
        await backup2.shareEncrypted(payload, password);
        message.textContent = "\u5206\u4EAB\u8996\u7A97\u5DF2\u95DC\u9589\uFF1B\u63A5\u6536\u7AEF\u53EF\u80FD\u6539\u5BEB\u526F\u6A94\u540D\uFF0C\u91CD\u8981\u5099\u4EFD\u8ACB\u512A\u5148\u4F7F\u7528\u300C\u53E6\u5B58 .salarymate\u300D\u3002";
      }
    }
  });
  dialog.append(heading, note, privacy, privacyDetails);
  if (security2 && !recovery) {
    const securityGroup = document.createElement("section");
    securityGroup.className = "data-center-group";
    const securityTitle = document.createElement("h3");
    securityTitle.textContent = "App \u5B58\u53D6\u4FDD\u8B77";
    const securityNote = document.createElement("p");
    securityNote.textContent = `${nativeCopy2?.lock ?? "App \u9396\u5B9A\u4F7F\u7528\u88DD\u7F6E\u9A57\u8B49\u3002"} ${nativeCopy2?.protection ?? "\u87A2\u5E55\u4FDD\u8B77\u6703\u963B\u64CB\u622A\u5716\u3001\u9304\u5F71\u8207\u6700\u8FD1\u4F7F\u7528\u756B\u9762\u9810\u89BD\u3002"}`;
    const settings = document.createElement("div");
    const renderSecurity = () => {
      const current = security2.currentStatus();
      settings.replaceChildren();
      const row = (title, description, action) => {
        const container = document.createElement("div");
        container.className = "security-setting";
        const copy = document.createElement("div");
        copy.className = "security-setting-copy";
        const strong = document.createElement("strong");
        strong.textContent = title;
        const detail = document.createElement("span");
        detail.textContent = description;
        copy.append(strong, detail);
        container.append(copy, action);
        return container;
      };
      const lockAction = button(current.lockEnabled ? "\u505C\u7528" : "\u555F\u7528", async () => {
        const result = await security2.configureLock(!current.lockEnabled);
        message.textContent = result.lockEnabled ? "\u5DF2\u555F\u7528 App \u9396\u5B9A\u3002" : "\u5DF2\u505C\u7528 App \u9396\u5B9A\u3002";
        renderSecurity();
      });
      settings.append(row(
        `App \u9396\u5B9A\uFF1A${current.lockEnabled ? "\u5DF2\u555F\u7528" : "\u672A\u555F\u7528"}`,
        current.available ? "\u652F\u63F4\u751F\u7269\u8FA8\u8B58\u6216\u88DD\u7F6E\u87A2\u5E55\u9396" : "\u8ACB\u5148\u8A2D\u5B9A\u88DD\u7F6E\u87A2\u5E55\u9396",
        lockAction
      ));
      const screenAction = button(current.screenProtectionEnabled ? "\u505C\u7528" : "\u555F\u7528", async () => {
        const result = await security2.setScreenProtection(!current.screenProtectionEnabled);
        message.textContent = result.screenProtectionEnabled ? result.screenProtectionActive ? `\u5DF2\u555F\u7528${nativeCopy2?.protectionName ?? "\u87A2\u5E55\u8207\u6700\u8FD1\u4F7F\u7528\u756B\u9762\u4FDD\u8B77"}\u3002` : "\u8A2D\u5B9A\u5DF2\u5132\u5B58\uFF0C\u4F46\u6B64\u88DD\u7F6E\u672A\u80FD\u555F\u52D5\u756B\u9762\u4FDD\u8B77\u3002" : "\u5DF2\u505C\u7528\u756B\u9762\u4FDD\u8B77\u3002";
        renderSecurity();
      });
      settings.append(row(
        `${nativeCopy2?.protectionName ?? "\u87A2\u5E55\u4FDD\u8B77"}\uFF1A${current.screenProtectionEnabled ? "\u5DF2\u555F\u7528" : "\u672A\u555F\u7528"}`,
        current.screenProtectionEnabled && !current.screenProtectionActive ? "\u76EE\u524D\u672A\u80FD\u78BA\u8A8D\u4FDD\u8B77\u5DF2\u751F\u6548" : nativeCopy2?.protection ?? "\u9632\u6B62\u622A\u5716\u3001\u9304\u5F71\u8207\u80CC\u666F\u9810\u89BD",
        screenAction
      ));
      if (current.lockEnabled) settings.append(row(
        "\u7ACB\u5373\u6E2C\u8A66\u9396\u5B9A",
        "\u95DC\u9589\u6B64\u8996\u7A97\u5F8C\u7ACB\u5373\u8981\u6C42\u88DD\u7F6E\u9A57\u8B49",
        button("\u7ACB\u5373\u9396\u5B9A", async () => {
          close();
          await security2.lockNow();
        })
      ));
    };
    renderSecurity();
    securityGroup.append(securityTitle, securityNote, settings);
    dialog.append(securityGroup);
  }
  if (app) {
    const backupGroup = document.createElement("section");
    backupGroup.className = "data-center-group";
    const title = document.createElement("h3");
    title.textContent = "\u5EFA\u7ACB\u5916\u90E8\u52A0\u5BC6\u5099\u4EFD";
    const detail = document.createElement("p");
    detail.textContent = "\u4F7F\u7528 AES-GCM \u52A0\u5BC6\u5B8C\u6574\u8CC7\u6599\u3002\u8ACB\u4EE5\u7CFB\u7D71\u6A94\u6848\u9078\u64C7\u5668\u53E6\u5B58\uFF0C\u4FDD\u7559 .salarymate \u526F\u6A94\u540D\uFF1B\u4E5F\u53EF\u4F7F\u7528\u7CFB\u7D71\u5206\u4EAB\u3002";
    const saveButton = button("\u8A2D\u5B9A\u5BC6\u78BC\u4E26\u53E6\u5B58 .salarymate", () => {
      if (document.querySelector("#appDialog")?.open) throw new Error("\u8ACB\u5148\u95DC\u9589\u7DE8\u8F2F\u8996\u7A97");
      newPassword("\u52A0\u5BC6\u4E26\u53E6\u5B58\u76EE\u524D\u8CC7\u6599", app.exportPayload(), "save");
    }, "btn btn-primary");
    const shareButton = button("\u6539\u7528\u7CFB\u7D71\u5206\u4EAB", () => {
      if (document.querySelector("#appDialog")?.open) throw new Error("\u8ACB\u5148\u95DC\u9589\u7DE8\u8F2F\u8996\u7A97");
      newPassword("\u52A0\u5BC6\u5206\u4EAB\u76EE\u524D\u8CC7\u6599", app.exportPayload(), "share");
    });
    backupGroup.append(title, detail, saveButton, shareButton);
    dialog.append(backupGroup);
  }
  const importGroup = document.createElement("section");
  importGroup.className = "data-center-group";
  const importTitle = document.createElement("h3");
  importTitle.textContent = "\u9084\u539F\u6216\u79FB\u8F49\u8CC7\u6599";
  const pickerLabel = document.createElement("label");
  pickerLabel.textContent = "\u9078\u64C7\u52A0\u5BC6\u5099\u4EFD\uFF08.salarymate\u3001BIN \u6216 .file\uFF09\u6216\u820A\u7248 JSON\uFF1B\u7CFB\u7D71\u6703\u9A57\u8B49\u5BE6\u969B\u5167\u5BB9\uFF1A";
  const picker = document.createElement("input");
  picker.className = "field";
  picker.type = "file";
  picker.accept = "*/*";
  pickerLabel.append(picker);
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    fileActions.replaceChildren();
    passwordPanel.replaceChildren();
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("\u6A94\u6848\u8D85\u904E 30 MB \u4E0A\u9650");
      const text = await file.text();
      const candidate = inspectBackupCandidate(file.name, text, backup2);
      if (candidate.kind === "encrypted") {
        message.textContent = `\u5DF2\u8B80\u53D6\u52A0\u5BC6\u5099\u4EFD\u300C${candidate.fileName}\u300D\uFF0C\u5C1A\u672A\u89E3\u5BC6\u6216\u9084\u539F\u3002`;
        createPasswordForm(passwordPanel, {
          title: "\u89E3\u9396\u9019\u4EFD\u52A0\u5BC6\u5099\u4EFD",
          confirmPassword: false,
          submitLabel: "\u89E3\u5BC6\u4E26\u6838\u5C0D\u5167\u5BB9",
          onSubmit: async (password) => {
            const payload = await backup2.decrypt(text, password);
            const summary = snapshotSummary(payload);
            message.textContent = `\u89E3\u5BC6\u6210\u529F\uFF1A${summary}\u3002\u5C1A\u672A\u9084\u539F\u3002`;
            fileActions.replaceChildren(button("\u78BA\u8A8D\u6B64\u5099\u4EFD\uFF0F\u7E7C\u7E8C\u9084\u539F", () => apply(payload), "btn btn-primary"));
          }
        });
      } else {
        message.textContent = `\u5DF2\u8B80\u53D6\u820A\u7248 JSON\u300C${candidate.fileName}\u300D\uFF1A${candidate.summary}\u3002\u6B64\u6A94\u6848\u672C\u8EAB\u672A\u52A0\u5BC6\uFF0C\u5C1A\u672A\u9084\u539F\u3002`;
        fileActions.replaceChildren(button("\u78BA\u8A8D\u6B64\u6A94\u6848\uFF0F\u7E7C\u7E8C\u9084\u539F", () => apply(text), "btn btn-primary"));
      }
    } catch (error) {
      message.textContent = friendlyError(error);
    } finally {
      picker.value = "";
    }
  });
  importGroup.append(importTitle, pickerLabel, fileActions);
  dialog.append(importGroup);
  const snapshotsGroup = document.createElement("section");
  snapshotsGroup.className = "data-center-group";
  const snapshotsTitle = document.createElement("h3");
  snapshotsTitle.textContent = "App \u5167\u4FDD\u8B77\u5FEB\u7167";
  const snapshotsNote = document.createElement("p");
  snapshotsNote.textContent = "\u67E5\u770B\u6700\u8FD1\u4E09\u4EFD\u5DF2\u5B8C\u6210\u5BEB\u5165\u7684\u8CC7\u6599\uFF1B\u640D\u58DE\u5FEB\u7167\u53EA\u6703\u6A19\u793A\uFF0C\u4E0D\u6703\u5617\u8A66\u8F09\u5165\u3002";
  snapshotsGroup.append(snapshotsTitle, snapshotsNote, button("\u67E5\u770B\u6700\u8FD1\u4E09\u4EFD\u4FDD\u8B77\u5FEB\u7167", async () => {
    if (!recovery) await window.SalaryMateStorage.flush?.();
    const rows = await repository2.list();
    list.replaceChildren();
    if (!rows.length) list.textContent = "\u76EE\u524D\u6C92\u6709\u4FDD\u8B77\u5FEB\u7167\u3002";
    for (const row of rows) {
      const card = document.createElement("section");
      const label = document.createElement("p");
      label.textContent = `${row.created_at} \u2014 ${row.valid ? row.summary : "\u640D\u58DE\u6216\u4E0D\u652F\u63F4\uFF0C\u7121\u6CD5\u9084\u539F"}`;
      card.append(label);
      if (row.valid) {
        card.append(button("\u9078\u64C7\u9019\u4EFD\u5FEB\u7167", () => apply(row.payload)));
        if (app) {
          card.append(button("\u4EE5\u5BC6\u78BC\u52A0\u5BC6\u5F8C\u53E6\u5B58", () => newPassword("\u52A0\u5BC6\u4E26\u53E6\u5B58\u6B64\u4FDD\u8B77\u5FEB\u7167", row.payload, "save")));
          card.append(button("\u4EE5\u5BC6\u78BC\u52A0\u5BC6\u5F8C\u5206\u4EAB", () => newPassword("\u52A0\u5BC6\u5206\u4EAB\u6B64\u4FDD\u8B77\u5FEB\u7167", row.payload, "share")));
        }
      }
      list.append(card);
    }
  }), list);
  dialog.append(snapshotsGroup, passwordPanel, message, button("\u7A0D\u5F8C\uFF0F\u95DC\u9589", close));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

// src/native-security.mjs
var CANCEL_CODES = /* @__PURE__ */ new Set(["AUTH_CANCELLED", "USER_CANCELLED"]);
var cloneStatus = (status2) => Object.freeze({ ...status2 });
function createSecurityCoverView(root) {
  const message = root.querySelector("[data-security-message]");
  const retry = root.querySelector("[data-security-unlock]");
  const leave = root.querySelector("[data-security-leave]");
  root.addEventListener("cancel", (event) => event.preventDefault());
  const setPageInert = (enabled) => {
    for (const node of root.parentElement?.children || []) {
      if (node !== root) node.inert = enabled;
    }
  };
  return Object.freeze({
    show(text, busy = false) {
      message.textContent = text;
      retry.disabled = busy;
      retry.textContent = busy ? "\u6B63\u5728\u9A57\u8B49\u2026" : "\u4F7F\u7528\u88DD\u7F6E\u89E3\u9396";
      setPageInert(true);
      root.hidden = false;
      if (!root.open) root.showModal();
      root.setAttribute("aria-busy", String(busy));
      if (!busy) retry.focus({ preventScroll: true });
    },
    hide() {
      root.hidden = true;
      if (root.open) root.close();
      root.setAttribute("aria-busy", "false");
      setPageInert(false);
    },
    isVisible: () => !root.hidden,
    bindRetry: (handler) => retry.addEventListener("click", handler),
    bindExit: (handler) => leave.addEventListener("click", handler)
  });
}
function createSecurityController({ appPlugin, deviceSecurity, privacyScreen, view }) {
  let status2 = {
    available: false,
    lockEnabled: false,
    screenProtectionEnabled: true,
    screenProtectionActive: false,
    locked: false
  };
  let authenticating = false;
  let gateResolve = null;
  const refresh = async () => {
    const next = await deviceSecurity.getStatus();
    status2 = { ...status2, ...next };
    return cloneStatus(status2);
  };
  const applyScreenProtection = async () => {
    try {
      if (status2.screenProtectionEnabled) {
        const result = await privacyScreen.enable({ android: { dimBackground: true, privacyModeOnActivityHidden: "none" } });
        status2.screenProtectionActive = result?.success !== false;
      } else {
        const result = await privacyScreen.disable();
        status2.screenProtectionActive = result?.success !== false ? false : status2.screenProtectionActive;
      }
    } catch {
      status2.screenProtectionActive = false;
    }
    return cloneStatus(status2);
  };
  const unlockMessage = (error) => {
    if (CANCEL_CODES.has(error?.code)) return "\u9A57\u8B49\u5DF2\u53D6\u6D88\uFF0C\u8CC7\u6599\u4ECD\u4FDD\u6301\u9396\u5B9A\u3002";
    if (error?.code === "AUTH_UNAVAILABLE") return "\u8ACB\u5148\u5728\u88DD\u7F6E\u8A2D\u5B9A\u555F\u7528\u87A2\u5E55\u9396\u6216\u751F\u7269\u8FA8\u8B58\uFF0C\u518D\u8FD4\u56DE\u91CD\u8A66\u3002";
    return "\u7121\u6CD5\u5B8C\u6210\u88DD\u7F6E\u9A57\u8B49\uFF0C\u8CC7\u6599\u4ECD\u4FDD\u6301\u9396\u5B9A\u3002\u8ACB\u91CD\u8A66\u3002";
  };
  const attemptUnlock = async () => {
    if (authenticating) return false;
    if (!status2.available) {
      view.show("\u8ACB\u5148\u5728\u88DD\u7F6E\u8A2D\u5B9A\u555F\u7528\u87A2\u5E55\u9396\u6216\u751F\u7269\u8FA8\u8B58\uFF0C\u518D\u8FD4\u56DE\u91CD\u8A66\u3002");
      return false;
    }
    authenticating = true;
    view.show("\u8ACB\u4F7F\u7528\u751F\u7269\u8FA8\u8B58\u6216\u88DD\u7F6E\u87A2\u5E55\u9396\u78BA\u8A8D\u8EAB\u5206\u3002", true);
    try {
      await deviceSecurity.authenticate({ reason: "\u89E3\u9396\u85AA\u8CC7\u8207\u5099\u4EFD\u8CC7\u6599" });
      status2.locked = false;
      view.hide();
      if (gateResolve) {
        const resolve2 = gateResolve;
        gateResolve = null;
        resolve2(cloneStatus(status2));
      }
      return true;
    } catch (error) {
      status2.locked = true;
      view.show(unlockMessage(error));
      return false;
    } finally {
      authenticating = false;
    }
  };
  view.bindRetry(async () => {
    try {
      await refresh();
    } catch {
      view.show("\u7121\u6CD5\u8B80\u53D6\u88DD\u7F6E\u5B89\u5168\u72C0\u614B\uFF0C\u8ACB\u7A0D\u5F8C\u91CD\u8A66\u3002");
      return;
    }
    await attemptUnlock();
  });
  view.bindExit(() => appPlugin.minimizeApp?.());
  return Object.freeze({
    async startGate() {
      await refresh();
      await applyScreenProtection();
      if (!status2.lockEnabled || status2.unlockedRecently) {
        status2.locked = false;
        view.hide();
        return cloneStatus(status2);
      }
      status2.locked = true;
      view.show("\u500B\u4EBA\u85AA\u8CC7\u7BA1\u7406\u5DF2\u9396\u5B9A\u3002");
      if (await attemptUnlock()) return cloneStatus(status2);
      return new Promise((resolve2) => {
        gateResolve = resolve2;
      });
    },
    async startLifecycle() {
      await appPlugin.addListener("appStateChange", async ({ isActive }) => {
        if (authenticating) return;
        if (!isActive) {
          view.show("\u85AA\u8CC7\u756B\u9762\u5DF2\u96B1\u85CF\u3002");
          if (status2.lockEnabled) status2.locked = true;
          return;
        }
        try {
          await refresh();
          if (status2.lockEnabled && status2.locked) await attemptUnlock();
          else view.hide();
        } catch {
          status2.locked = true;
          view.show("\u7121\u6CD5\u8B80\u53D6\u88DD\u7F6E\u5B89\u5168\u72C0\u614B\uFF0C\u85AA\u8CC7\u8CC7\u6599\u4FDD\u6301\u9396\u5B9A\u3002");
        }
      });
    },
    async configureLock(enabled) {
      authenticating = true;
      try {
        const result = await deviceSecurity.configureLock({ enabled: Boolean(enabled) });
        status2 = { ...status2, ...result, lockEnabled: Boolean(result.lockEnabled ?? enabled), locked: false };
        view.hide();
        return cloneStatus(status2);
      } finally {
        authenticating = false;
      }
    },
    async setScreenProtection(enabled) {
      const result = await deviceSecurity.setScreenProtectionEnabled({ enabled: Boolean(enabled) });
      status2.screenProtectionEnabled = Boolean(result.screenProtectionEnabled ?? enabled);
      return applyScreenProtection();
    },
    async lockNow() {
      await refresh();
      if (!status2.lockEnabled) return false;
      status2.locked = true;
      view.show("\u500B\u4EBA\u85AA\u8CC7\u7BA1\u7406\u5DF2\u9396\u5B9A\u3002");
      return attemptUnlock();
    },
    failClosed(message = "\u5B89\u5168\u4FDD\u8B77\u7121\u6CD5\u555F\u52D5\uFF0C\u85AA\u8CC7\u8CC7\u6599\u4FDD\u6301\u9396\u5B9A\u3002") {
      status2.locked = true;
      view.show(message);
    },
    currentStatus: () => cloneStatus(status2),
    isCovered: () => view.isVisible()
  });
}

// src/native-platform.mjs
function platformPrivacyScreen(platform2, androidPlugin, deviceSecurity) {
  return platform2 === "ios" ? Object.freeze({
    async enable() {
      const state = await deviceSecurity.setScreenProtectionEnabled({ enabled: true });
      return { success: state.screenProtectionEnabled === true };
    },
    async disable() {
      const state = await deviceSecurity.setScreenProtectionEnabled({ enabled: false });
      return { success: state.screenProtectionEnabled === false };
    }
  }) : androidPlugin;
}
function platformLifecycle(platform2, appPlugin, deviceSecurity) {
  return platform2 === "ios" ? Object.freeze({ addListener: (name, handler) => deviceSecurity.addListener(name, handler) }) : appPlugin;
}
function platformCopy(platform2) {
  const ios = platform2 === "ios";
  return Object.freeze({
    lock: ios ? "App \u9396\u5B9A\u4F7F\u7528 Face ID\u3001Touch ID \u6216 iPhone \u88DD\u7F6E\u5BC6\u78BC\u3002" : "App \u9396\u5B9A\u4F7F\u7528 Android \u7CFB\u7D71\u9A57\u8B49\u3002",
    protection: ios ? "\u5207\u81F3\u80CC\u666F\u6642\u96B1\u85CF App \u9810\u89BD\uFF1B\u4E0D\u963B\u64CB\u7CFB\u7D71\u622A\u5716\u6216\u87A2\u5E55\u9304\u5F71\u3002" : "\u9632\u6B62\u622A\u5716\u3001\u9304\u5F71\u8207\u80CC\u666F\u9810\u89BD",
    protectionName: ios ? "\u80CC\u666F\u756B\u9762\u4FDD\u8B77" : "\u87A2\u5E55\u4FDD\u8B77"
  });
}

// src/bootstrap.mjs
var platform = Capacitor.getPlatform();
document.documentElement.dataset.platform = platform;
var nativeCopy = platformCopy(platform);
if (platform === "ios") document.querySelector("[data-security-leave]").hidden = true;
var repository;
var security;
var DeviceSecurity = registerPlugin("DeviceSecurity");
var BackupFile = registerPlugin("BackupFile");
var backup = createBackupService(
  Filesystem,
  Share,
  Directory.Cache,
  Encoding.UTF8,
  "4.3.2-RC.3",
  void 0,
  BackupFile
);
var status = document.createElement("div");
status.className = "storage-status";
status.setAttribute("role", "status");
status.textContent = "\u6B63\u5728\u8B80\u53D6\u672C\u6A5F\u8CC7\u6599\u2026";
document.body.prepend(status);
function report(state) {
  status.textContent = {
    pending: "\u6B63\u5728\u5132\u5B58\uFF0C\u8ACB\u52FF\u95DC\u9589 App\u2026",
    saved: "\u5DF2\u5132\u5B58\u81F3\u672C\u6A5F\u8CC7\u6599\u5EAB",
    failed: "\u5132\u5B58\u5931\u6557\uFF1A\u8B8A\u66F4\u5C1A\u672A\u4FDD\u5B58\u3002\u8ACB\u5148\u5099\u4EFD\u5168\u90E8\u8CC7\u6599\uFF0C\u52FF\u7E7C\u7E8C\u4FEE\u6539\u6216\u76F4\u63A5\u95DC\u9589 App\u3002"
  }[state];
  status.dataset.state = state;
}
try {
  if (Capacitor.isNativePlatform()) {
    security = createSecurityController({
      appPlugin: platformLifecycle(platform, App, DeviceSecurity),
      deviceSecurity: DeviceSecurity,
      privacyScreen: platformPrivacyScreen(platform, i, DeviceSecurity),
      view: createSecurityCoverView(document.querySelector("#securityCover"))
    });
    await security.startGate();
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const db = await sqlite.createConnection("salarymate", false, "no-encryption", 1, false);
    await db.open();
    repository = new SnapshotRepository(db);
    window.SalaryMateStorage = await createNativeStore(repository, localStorage, report);
    window.SalaryMateNative = {
      openDataCenter: () => openDataCenter({ repository, backup, app: window.SalaryMateData, security, nativeCopy })
    };
    report("saved");
  } else {
    window.SalaryMateStorage = Object.freeze({
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key)
    });
    status.textContent = "\u8CC7\u6599\u4FDD\u5B58\u5728\u76EE\u524D\u700F\u89BD\u5668\uFF1B\u8207\u624B\u6A5F App \u4E0D\u540C\u6B65";
  }
  const script = document.createElement("script");
  script.src = "./app.js?v=4.3.2-RC.3";
  script.onload = async () => {
    try {
      if (repository) {
        const rawExport = document.querySelector('[data-action="export-json"]');
        if (rawExport) rawExport.hidden = true;
        const rawImport = document.querySelector("#jsonImport")?.closest("label");
        if (rawImport) rawImport.hidden = true;
        const entry = document.createElement("button");
        entry.type = "button";
        entry.textContent = "\u8CC7\u6599\u4FDD\u8B77\uFF0F\u52A0\u5BC6\u5099\u4EFD\uFF0F\u79FB\u8F49";
        entry.onclick = () => {
          document.querySelector("#dataMenu").hidden = true;
          document.querySelector("#dataMenuButton").setAttribute("aria-expanded", "false");
          window.SalaryMateNative.openDataCenter();
        };
        document.querySelector("#dataMenu .menu-section").append(entry);
        await security.startLifecycle();
        if (platform === "android") await App.addListener("backButton", async () => {
          if (security.isCovered()) return App.exitApp();
          const center = document.querySelector("dialog.data-center[open]");
          if (center) {
            center.close();
            return;
          }
          if (window.SalaryMateData?.handleBackButton?.()) return;
          await App.exitApp();
        });
      }
      if (repository && !window.SalaryMateStorage.getItem("salarymate_v310_state")) window.SalaryMateNative.openDataCenter();
    } catch {
      status.textContent = "\u5B89\u5168\u76E3\u807D\u7121\u6CD5\u555F\u52D5\uFF0C\u5DF2\u505C\u6B62\u986F\u793A\u85AA\u8CC7\u8CC7\u6599\u3002\u8ACB\u4FDD\u7559 App \u4E26\u91CD\u65B0\u555F\u52D5\u3002";
      status.dataset.state = "failed";
      security?.failClosed();
    }
  };
  document.body.appendChild(script);
} catch {
  status.textContent = "\u7121\u6CD5\u5B89\u5168\u958B\u555F\u672C\u6A5F\u8CC7\u6599\uFF0C\u5DF2\u505C\u6B62\u8F09\u5165\uFF0C\u672A\u6E05\u9664\u6216\u8986\u5BEB\u539F\u8CC7\u6599\u3002\u8ACB\u4FDD\u7559 App\uFF0C\u52FF\u89E3\u9664\u5B89\u88DD\u3002";
  status.dataset.state = "failed";
  security?.failClosed();
  if (repository) {
    const recover = document.createElement("button");
    recover.className = "btn";
    recover.textContent = "\u9078\u64C7\u4FDD\u8B77\u5FEB\u7167\u6216 JSON \u6551\u63F4";
    recover.onclick = () => openDataCenter({ repository, backup, recovery: true });
    status.append(recover);
  }
}
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
