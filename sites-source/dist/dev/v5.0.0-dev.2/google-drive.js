/* Browser-to-Google Drive only. OAuth tokens never enter storage, backups or Site APIs. */
(function(root){
  'use strict';
  const SCOPE='https://www.googleapis.com/auth/drive.file', API='https://www.googleapis.com/drive/v3/', UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
  const CONFIG_KEY='salarymate_v5_google_client_id', MAX_BYTES=45*1024*1024, TAG='salarymate-v5-backup', FOLDER='salarymate-v5-folder';
  const fail=message=>{throw new Error(message);};
  const supported=()=>root.location?.protocol==='https:' || (root.location?.protocol==='http:' && ['localhost','127.0.0.1'].includes(root.location.hostname));
  const validClientId=value=>/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value||'');
  let loading;
  function loadIdentity(){
    if(!supported())return Promise.reject(new Error('Google 連線需要 HTTPS 網站或 localhost；直接開啟 HTML 檔案時，請改用網站版或下載備份。'));
    if(root.google?.accounts?.oauth2)return Promise.resolve();
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const script=root.document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.referrerPolicy='no-referrer';
      const timer=root.setTimeout(()=>done(new Error('Google 登入元件載入失敗，請檢查網路後重試。')),15000);
      const done=error=>{root.clearTimeout(timer);if(error){script.remove();loading=null;reject(error);}else resolve();};
      script.onload=()=>root.google?.accounts?.oauth2?done():done(new Error('Google 登入元件載入失敗，請檢查網路後重試。'));
      script.onerror=()=>done(new Error('Google 登入元件載入失敗，請檢查網路後重試。'));root.document.head.append(script);
    });return loading;
  }
  function createClient(onChange=()=>{}){
    let token='',expires=0,user=null,generation=0,pendingAuth=null,busy=false,expiryTimer;
    const requests=new Set(),known=new Map();
    const connected=()=>!!token&&Date.now()<expires;
    const status=()=>({connected:connected(),user:user?{...user}:null,busy});
    const notify=()=>onChange(status());
    function disconnect(){
      generation++;token='';expires=0;user=null;known.clear();root.clearTimeout(expiryTimer);
      for(const controller of requests)controller.abort();requests.clear();
      pendingAuth?.(new Error('Google 連線已取消。'));pendingAuth=null;notify();
    }
    function clientId(){try{return root.localStorage.getItem(CONFIG_KEY)||'';}catch{return '';}}
    function configure(value){
      value=String(value||'').trim();if(value&&!validClientId(value))fail('請填寫有效的 Google OAuth 用戶端 ID。');
      if(busy||pendingAuth)fail('請等目前操作完成。');
      if(value!==clientId())disconnect();
      try{if(value)root.localStorage.setItem(CONFIG_KEY,value);else root.localStorage.removeItem(CONFIG_KEY);}catch{fail('無法儲存連線設定，請確認瀏覽器允許本機儲存。');}
    }
    const endpoint=(path,params={})=>API+path+'?'+new URLSearchParams(params);
    const operationOf=(url,method)=>{
      const path=url.pathname;
      if(path.endsWith('/about'))return '確認 Google 帳戶';
      if(path.startsWith('/upload/'))return method==='PUT'?'傳送備份內容':'建立備份上傳';
      if(method==='POST')return '建立備份資料夾';
      if(method==='PATCH')return '修改雲端備份';
      return path.endsWith('/files')?'讀取備份清單':'讀取雲端備份';
    };
    async function forbidden(response,operation){
      // Google sends a short JSON reason. Never display its arbitrary message,
      // request URL, file ID, OAuth token, or any part of a backup payload.
      let body;
      try{body=await response.json();}catch{}
      const raw=body?.error?.errors?.[0]?.reason||body?.error?.details?.find(item=>item?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo')?.reason||'';
      const reason=/^[A-Za-z][A-Za-z0-9_.-]{0,80}$/.test(raw)?raw:'';
      let advice;
      switch(reason.toLowerCase()){
        case 'accessnotconfigured':
        case 'service_disabled':
          advice='此 OAuth 用戶端 ID 所屬的 Google Cloud 專案尚未啟用 Google Drive API。請在同一個專案啟用 API，稍後重新連線。';break;
        case 'insufficientpermissions':
        case 'access_token_scope_insufficient':
          advice='Google 授權缺少 drive.file 檔案權限。請在 Google Auth Platform 加入該權限後，重新連線並同意授權。';break;
        case 'appnotauthorizedtofile':
          advice='目前的 OAuth 用戶端無權讀取這份檔案。請確認使用建立備份時相同的 Google Cloud 專案及 Google 帳戶。';break;
        case 'insufficientfilepermissions':
          advice='這個 Google 帳戶沒有修改該檔案的權限。請確認所選帳戶與備份擁有者相同。';break;
        case 'storagequotaexceeded':
          advice='這個 Google 帳戶的雲端容量不足，請到 Google Drive 檢查儲存空間。';break;
        case 'ratelimitexceeded':
        case 'userratelimitexceeded':
        case 'dailylimitexceeded':
          advice='Google Drive 請求額度暫時不足，請稍後重試，並檢查該 Cloud 專案的 API 配額。';break;
        case 'domainpolicy':
        case 'accessdenied':
          advice='Google 帳戶或所屬組織限制了 Drive 存取，請檢查帳戶與管理員政策。';break;
        default:
          advice='Google Drive 拒絕存取。請先確認 OAuth 用戶端 ID 所屬專案已啟用 Drive API，並已授予 drive.file 權限。';
      }
      return `${operation}失敗：${advice}（Google 原因代碼：${reason||'未提供'}）`;
    }
    async function request(url,init={},acceptIncomplete=false){
      const u=new URL(url);
      if(u.origin!=='https://www.googleapis.com'||(!u.pathname.startsWith('/drive/v3/')&&!u.pathname.startsWith('/upload/drive/v3/files'))||u.username||u.password)fail('已阻止非 Google Drive 的資料傳輸。');
      if(!connected()){disconnect();fail('Google 授權已過期，請重新連線。');}
      const session=generation,controller=new root.AbortController();requests.add(controller);
      const timer=root.setTimeout(()=>controller.abort(),60000);
      try{
        const response=await root.fetch(url,{...init,headers:{...init.headers,Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
        if(session!==generation)fail('Google 連線已取消。');
        if(response.status===401){disconnect();fail('Google 授權已過期，請重新連線。');}
        if(response.status===403)fail(await forbidden(response,operationOf(u,init.method||'GET')));
        if(response.status===404)fail('找不到這份雲端備份，請重新整理清單。');
        if(response.status===429)fail('Google Drive 暫時限制請求，請稍後重試。');
        if(!response.ok&&!(acceptIncomplete&&response.status===308))fail('Google Drive 暫時無法完成操作，請重新整理清單後再試。');
        return response;
      }catch(error){
        if(session!==generation)fail('Google 連線已取消。');
        if(error.name==='AbortError'||error instanceof TypeError)fail('連線中斷或逾時。上傳結果尚未確認，請重新整理雲端清單；本機資料仍保留。');
        throw error;
      }finally{root.clearTimeout(timer);requests.delete(controller);}
    }
    async function json(path,params,init){const session=generation,result=await (await request(endpoint(path,params),init)).json();if(session!==generation)fail('Google 連線已取消。');return result;}
    // Must be called directly from a user gesture, after loadIdentity has completed.
    function connect(){
      if(!supported())return Promise.reject(new Error('Google 連線需要 HTTPS 網站或 localhost；直接開啟 HTML 檔案時，請改用網站版或下載備份。'));
      if(!validClientId(clientId()))return Promise.reject(new Error('請先完成 Google 連線設定。'));
      if(!root.google?.accounts?.oauth2)return Promise.reject(new Error('Google 登入元件尚未就緒，請稍後重試。'));
      if(busy||pendingAuth)return Promise.reject(new Error('請等目前操作完成。'));
      disconnect();const session=generation;
      return new Promise((resolve,reject)=>{
        const timeout=root.setTimeout(()=>finish(new Error('Google 授權未完成，請重新連線。')),120000);
        const finish=(error,value)=>{if(pendingAuth!==cancel)return;pendingAuth=null;root.clearTimeout(timeout);error?reject(error):resolve(value);};
        const cancel=error=>finish(error);pendingAuth=cancel;
        try{
          const auth=root.google.accounts.oauth2.initTokenClient({client_id:clientId(),scope:SCOPE,include_granted_scopes:false,
            error_callback:()=>finish(new Error('Google 視窗已關閉或遭封鎖，請允許彈出視窗後重試。')),
            callback:async response=>{
              if(session!==generation||pendingAuth!==cancel)return;
              if(response.error||!response.access_token||!root.google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE))return finish(new Error('尚未授予 Google Drive 檔案權限，未傳送任何備份。'));
              const seconds=Number(response.expires_in);if(!Number.isFinite(seconds)||seconds<=30)return finish(new Error('Google 授權未完成，請重新連線。'));
              token=response.access_token;expires=Date.now()+(seconds-30)*1000;
              try{
                const about=await json('about',{fields:'user(displayName,emailAddress,permissionId)'});
                if(session!==generation)return;
                if(!about.user?.permissionId)fail('無法確認 Google 帳戶，請重新連線。');
                user=about.user;expiryTimer=root.setTimeout(()=>disconnect(),expires-Date.now());notify();finish(null,status());
              }catch(error){token='';expires=0;user=null;notify();finish(error);}
            }});
          auth.requestAccessToken({prompt:'select_account'});
        }catch{finish(new Error('Google 授權未完成，請檢查用戶端 ID 與授權來源網址。'));}
      });
    }
    async function revoke(){
      const value=connected()?token:'';disconnect();
      if(!value)fail('連線已中斷。如需撤銷授權，請到 Google 帳戶的第三方連線設定。');
      return new Promise((resolve,reject)=>{const timer=root.setTimeout(()=>reject(new Error('撤銷結果未確認，請到 Google 帳戶的第三方連線設定檢查。')),15000);
        root.google.accounts.oauth2.revoke(value,result=>{root.clearTimeout(timer);result.successful?resolve():reject(new Error('撤銷結果未確認，請到 Google 帳戶的第三方連線設定檢查。'));});});
    }
    const fields='id,name,modifiedTime,size,appProperties,mimeType,ownedByMe,trashed';
    function validateFile(file){if(!file||!/^[A-Za-z0-9_-]+$/.test(file.id)||file.appProperties?.salarymate!==TAG||file.mimeType!=='application/json'||file.trashed||!file.ownedByMe)fail('這不是此帳戶的個人薪資與投資管理備份。');return file;}
    async function list(pageToken=''){
      const result=await json('files',{q:`trashed = false and 'me' in owners and appProperties has { key='salarymate' and value='${TAG}' }`,spaces:'drive',pageSize:'100',orderBy:'createdTime desc',fields:`nextPageToken,files(${fields})`,...(pageToken?{pageToken}:{})});
      if(!pageToken)known.clear();const files=(result.files||[]).map(validateFile);for(const file of files)known.set(file.id,file);
      return {files,nextPageToken:result.nextPageToken||''};
    }
    async function owned(id){if(!known.has(id))fail('請先重新整理雲端備份清單。');return validateFile(await json('files/'+encodeURIComponent(id),{fields}));}
    async function mutate(fn){if(busy)fail('請等目前操作完成。');busy=true;notify();try{return await fn();}finally{busy=false;notify();}}
    async function folder(){
      const found=await json('files',{q:`trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='salarymate' and value='${FOLDER}' }`,fields:'files(id)',pageSize:'1'});
      if(found.files?.[0]?.id)return found.files[0].id;
      const created=await json('files',{fields:'id'},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'個人薪資與投資管理',mimeType:'application/vnd.google-apps.folder',appProperties:{salarymate:FOLDER}})});return created.id;
    }
    async function upload(payload,name){return mutate(async()=>{
      const text=JSON.stringify(payload),bytes=new TextEncoder().encode(text);if(bytes.length>MAX_BYTES)fail('備份檔案超過 45 MB。');
      if(!payload||(!root.SalaryMateBackup.isEncrypted(payload)&&(!Array.isArray(payload.companies)||!Array.isArray(payload.records))))fail('不支援的備份格式。');
      name=String(name||'').trim();if(!name||name.length>160)fail('備份名稱請填寫 1 至 160 個字元。');
      const session=generation,parent=await folder();if(session!==generation)fail('Google 連線已取消。');
      const metadata={name:name.endsWith('.json')?name:name+'.json',mimeType:'application/json',parents:[parent],appProperties:{salarymate:TAG,encrypted:root.SalaryMateBackup.isEncrypted(payload)?'true':'false'}};
      const response=await request(UPLOAD+'?'+new URLSearchParams({uploadType:'resumable',fields}),{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(bytes.length)},body:JSON.stringify(metadata)});
      const location=response.headers.get('Location');if(!location)fail('Google Drive 未提供上傳位置，請重試。');
      const target=new URL(location);if(target.origin!=='https://www.googleapis.com'||target.pathname!=='/upload/drive/v3/files'||target.searchParams.get('uploadType')!=='resumable')fail('已阻止非 Google Drive 的資料傳輸。');
      const file=validateFile(await (await request(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:bytes})).json());known.set(file.id,file);return file;
    });}
    async function download(id){
      const session=generation;
      const file=await owned(id);if(Number(file.size)>MAX_BYTES)fail('備份檔案超過 45 MB。');
      const response=await request(endpoint('files/'+encodeURIComponent(id),{alt:'media'}));
      if(Number(response.headers.get('Content-Length'))>MAX_BYTES)fail('備份檔案超過 45 MB。');
      let text='';
      if(response.body?.getReader){const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)fail('備份檔案超過 45 MB。');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}}
      else{text=await response.text();if(new TextEncoder().encode(text).length>MAX_BYTES)fail('備份檔案超過 45 MB。');}
      if(session!==generation||!connected())fail('Google 連線已取消。');
      return {name:file.name,size:new TextEncoder().encode(text).length,text:async()=>text};
    }
    const rename=(id,name)=>mutate(async()=>{await owned(id);name=String(name||'').trim();if(!name||name.length>160)fail('備份名稱請填寫 1 至 160 個字元。');const result=await json('files/'+encodeURIComponent(id),{fields},{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});validateFile(result);known.set(id,result);return result;});
    const trash=id=>mutate(async()=>{await owned(id);await json('files/'+encodeURIComponent(id),{fields:'id,trashed'},{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});known.delete(id);});
    return Object.freeze({status,clientId,configure,connect,disconnect,revoke,list,upload,download,rename,trash});
  }
  root.SalaryMateGoogleDrive=Object.freeze({createClient,loadIdentity,supported,validClientId});
})(globalThis);
