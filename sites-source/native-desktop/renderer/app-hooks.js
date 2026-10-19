// Inserted only into the desktop startup closure by build-desktop-assets.mjs.
window.SalaryMateDesktopFeatures?.attach({
  open:(title,body,wide)=>{
    if(hasDirtyDraft()||($('#appDialog')?.open&&!document.querySelector('#desktopQuickPanel, #desktopOptionsForm, #desktopBackupPanel')))throw Error('DIALOG_BUSY');
    openDialog(title,body,wide);
  },
  close:()=>{
    if(hasDirtyDraft()||($('#appDialog')?.open&&!document.querySelector('#desktopQuickPanel, #desktopOptionsForm, #desktopBackupPanel')))return false;
    closeDialog();return true;
  },toast,
  hasChanges:hasDirtyDraft,
  settingsSaved:captureDialogBaseline,
  canOpen:()=>!hasDirtyDraft()&&!$('#appDialog')?.open&&!['loading','submitting'].includes(runtimeState.operationStatus),
  canBackup:()=>!['idle','loading','failure'].includes(runtimeState.dataStatus)&&!['loading','submitting'].includes(runtimeState.operationStatus),
  company:()=>currentCompany()?.name||'—',
  snapshot:async()=>{
    await window.SalaryMateStorage.flush?.();
    if(['idle','loading','failure'].includes(runtimeState.dataStatus))throw Error('DATA_NOT_READY');
    validateBackupCollections(state);
    return window.SalaryMateData.exportPayload();
  },
  importBackup:payload=>window.SalaryMateData.importPayload(payload),
  quick:kind=>{
    if(hasDirtyDraft()||$('#appDialog')?.open||['loading','submitting'].includes(runtimeState.operationStatus)){toast('請先完成或關閉目前的編輯視窗。','error');return;}
    const actions={record:openRecordForm,overtime:openOvertimeForm,leave:openLeaveForm,transaction:()=>{
      const button=document.createElement('button');button.dataset.stock='transaction';stocksUI.click(button);
    }};
    actions[kind]?.();
  },
  previewReport:previewAnnualReport,
  report:()=>{
    const data=annualAnalysisData();
    return {html:window.SalaryMateI18n.html(annualReportHtml(data)),fileName:`SalaryMate_${data.year}_01-${pad2(data.throughMonth)}_report.pdf`,landscape:true};
  }
});
