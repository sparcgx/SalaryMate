'use strict';
const {SHORTCUTS}=require('./backups.cjs');
function createQuickEntry({globalShortcut,makeTray,send}) {
  let shortcut='',tray=null;
  return {
    enabled:()=>Boolean(shortcut),
    configure(options) {
      const next=options.shortcutEnabled?options.shortcut:'';
      if(next&&!SHORTCUTS.includes(next))throw Object.assign(Error('INVALID_OPTIONS'),{code:'INVALID_OPTIONS'});
      if(next===shortcut)return;
      if(next&&!globalShortcut.register(next,()=>send('quick')))throw Object.assign(Error('SHORTCUT_UNAVAILABLE'),{code:'SHORTCUT_UNAVAILABLE'});
      try{if(next&&!tray)tray=makeTray();}
      catch(error){if(next)globalShortcut.unregister(next);throw error;}
      if(shortcut)globalShortcut.unregister(shortcut);
      shortcut=next;
      if(!next){tray?.destroy();tray=null;}
    },
    dispose(){if(shortcut)globalShortcut.unregister(shortcut);shortcut='';tray?.destroy();tray=null;}
  };
}
module.exports={createQuickEntry};
