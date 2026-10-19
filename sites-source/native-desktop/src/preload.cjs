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
  openDocument: () => invoke('salarymate:open'),
  featuresState: () => invoke('salarymate:features-state'),
  chooseBackupDirectory: () => invoke('salarymate:backup-directory'),
  configureFeatures: options => invoke('salarymate:features-configure',options),
  backupSnapshot: input => invoke('salarymate:backup-snapshot',input),
  backupHistory: () => invoke('salarymate:backup-history'),
  readBackup: id => invoke('salarymate:backup-read',id),
  exportPdf: input => invoke('salarymate:report-pdf',input),
  updateState:()=>invoke('salarymate:updates-state'),
  checkUpdates:()=>invoke('salarymate:updates-check'),
  downloadUpdate:()=>invoke('salarymate:updates-download'),
  cancelUpdate:()=>invoke('salarymate:updates-cancel'),
  revealUpdate:()=>invoke('salarymate:updates-reveal'),
  installUpdate:data=>invoke('salarymate:updates-install',data),
  onUpdateState:listener=>{
    if(typeof listener!=='function')return ()=>{};
    const handler=(_event,state)=>listener(state);
    ipcRenderer.on('salarymate:update-state',handler);
    return ()=>ipcRenderer.removeListener('salarymate:update-state',handler);
  },
  onDesktopAction: listener => {
    if(typeof listener!=='function')return ()=>{};
    const allowed=new Set(['quick','record','overtime','leave','transaction','backups','options','pdf','updates']);
    const handler=(_event,action)=>{if(allowed.has(action))listener(action);};
    ipcRenderer.on('salarymate:desktop-action',handler);
    return ()=>ipcRenderer.removeListener('salarymate:desktop-action',handler);
  }
}));
