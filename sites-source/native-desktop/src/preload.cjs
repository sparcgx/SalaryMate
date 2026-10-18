'use strict';
const {contextBridge, ipcRenderer} = require('electron');
// Only dialog-mediated operations; no filesystem paths, shell or generic IPC.
function invoke(channel, input) {
  return ipcRenderer.invoke(channel, input).then(result => {
    if (!result?.ok) throw Object.assign(new Error(result?.code || 'BRIDGE_UNAVAILABLE'), {code: result?.code || 'BRIDGE_UNAVAILABLE'});
    return result;
  });
}
contextBridge.exposeInMainWorld('SalaryMateDesktop', Object.freeze({
  platform: process.platform,
  saveDocument: input => invoke('salarymate:save', input),
  openDocument: () => invoke('salarymate:open')
}));
