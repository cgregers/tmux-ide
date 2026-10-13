// Private canonical daemon + exact packaged browser/native UI. Never synthesizes application state.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {access,stat,mkdir,readFile,rm} from 'node:fs/promises';
import {constants,existsSync,writeFileSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {StringDecoder} from 'node:string_decoder';
import {createScratchFleet} from '../../scripts/lib/product-fixtures/scratch-fleet.ts';
import {stopFixtureChild} from '../../apps/tmux-gpui/bridge/fixture-child.mjs';
const [app,cli,out]=process.argv.slice(2);
for(const value of [app,cli,out])assert.ok(value&&isAbsolute(value),'Explicit absolute app, CLI and fresh receipt required');
assert.ok(!existsSync(out),'Receipt must be fresh');
assert.ok((await stat(app)).isDirectory());
const binary=join(app,'Contents/MacOS/tmux-ide-gpui');
const node=join(app,'Contents/Resources/node');
const browserEntry=join(app,'Contents/Resources/bridge/browser.bundle.mjs');
const liveEntry=join(app,'Contents/Resources/bridge/live.bundle.mjs');
for(const file of [binary,node,browserEntry,liveEntry,cli]){
 assert.ok((await stat(file)).isFile(),'Artifact must be regular file');
 await access(file,[binary,node].includes(file)?constants.X_OK:constants.R_OK);
}
const hashes={};for(const [name,path] of Object.entries({native:binary,node,browser:browserEntry,live:liveEntry,cli}))hashes[name]=createHash('sha256').update(await readFile(path)).digest('hex');
for(const key of Object.keys(process.env))if(key.startsWith('TMUX_IDE_')||['TMUX','TMUX_PANE','TMUX_TMPDIR','NODE_OPTIONS','NODE_PATH'].includes(key))delete process.env[key];
let fleet,env,daemon,browser,native,latest,latestLine,record,before;
let condition="setup",closing=false,fatal=null,nativeResult=null,rootRemoved=false,publications=0,commands=0;
let diagnosticBytes=0;const errors=[],trace=[],seenSessions=new Map(),seenTabs=new Map(),tabSessions=new Map(),pending=new Map();
let switched=false,inactiveClosed=false,activeClosed=false,resizeCount=0,inputCount=0;
const decoders={browser:new StringDecoder('utf8'),native:new StringDecoder('utf8')};
const buffers={browser:'',native:''};
const fail=(code)=>{fatal??=new Error(code);};
const cancel=()=>fail('cancelled');
process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
const deadline=Date.now()+600000;
const ordinal=(map,id)=>{if(id==null)return null;if(!map.has(id))map.set(id,map.size+1);return map.get(id);};
const event=(kind)=>{
 if(trace.length>=512)trace.shift();
 trace.push({kind,request:latest?.request,sequence:latest?.sequence,surface:latest?.surface,tabs:latest?.sessionTabs?.rows.length??0,session:ordinal(seenSessions,latest?.selectedSession),activeTab:ordinal(seenTabs,latest?.sessionTabs?.active),frame:!!latest?.snapshot,inputReady:latest?.inputReady===true});
};
const check=()=>{if(fatal)throw fatal;assert.ok(Date.now()<deadline,'total-deadline');};
async function until(predicate,ms=45000){const end=Math.min(deadline,Date.now()+ms);for(;;){check();if(await predicate())return;assert.ok(Date.now()<end,'startup-deadline');await delay(25);}}
const tmux=(...args)=>execFileSync(env.TMUX_IDE_TMUX_BIN,['-S',fleet.socketPath,...args],{env,encoding:'utf8',timeout:5000});
const source=()=>tmux('list-panes','-a','-F','#{pane_id}|#{pane_pid}|#{pane_birth_id}').trim().split('\n').sort();
function own(child,kind){
 child.on('error',()=>fail(`${kind}-spawn-error`));
 child.on('exit',()=>{if(kind!=='native'&&!closing)fail(`${kind}-early-exit`);});
 child.on('close',(code,signal)=>{if(kind==='native')nativeResult={code,signal};});
 for(const stream of [child.stdin,child.stdout,child.stderr].filter(Boolean))stream.on('error',error=>{if(!closing&&!(kind==='native'&&stream===child.stdin&&error.code==='EPIPE'&&(child.exitCode!==null||child.signalCode!==null)))fail(`${kind}-stream-error`);});
 child.stderr?.on('data',chunk=>{diagnosticBytes+=chunk.length;if(diagnosticBytes>1024*1024)fail('diagnostic-bound');});
 return child;
}
function write(child,line,bound){assert.ok(child?.stdin.writable&&!child.stdin.destroyed,'relay-destination-closed');assert.ok(child.stdin.writableLength+Buffer.byteLength(line)<bound,'relay-backlog-bound');child.stdin.write(line);}
function publication(value,line){
 condition='publication-bounds';
 assert.ok(++publications<=30000,'publication-count-bound');
 assert.equal(value.version,1);assert.ok(Number.isSafeInteger(value.sequence)&&value.sequence>(latest?.sequence??0),'publication-sequence');
 latest=value;latestLine=line;
 const tabs=value.sessionTabs;
 assert.ok(tabs&&tabs.request===value.request&&tabs.rows.length<=8,'real-tab-publication-required');
 if(value.snapshot&&value.inputReady&&tabs.active){
  condition="accepted-tab-identity";
  const known=tabSessions.has(tabs.active);
  ordinal(seenTabs,tabs.active);ordinal(seenSessions,value.selectedSession);
  if(!known){tabSessions.set(tabs.active,value.selectedSession);event('accepted-tab');}
  else assert.equal(value.selectedSession,tabSessions.get(tabs.active),'tab-session-identity-changed');
 }
 for(const [attempt,action] of pending){
  const result=value.sessionTabResult;
  if(result?.request===attempt){
   condition="tab-result-correlation";
   assert.equal(result.fromRequest,action.fromRequest);assert.equal(result.action,action.action);assert.equal(result.revision,action.revision);
   if(result.outcome==='closed'){
    condition='inactive-close-preserves-terminal';
    assert.equal(action.kind,'inactive-close');assert.equal(value.request,action.fromRequest);
    assert.equal(value.selectedSession,action.session);assert.equal(value.selectedPane,action.pane);assert.ok(value.snapshot&&value.inputReady);
    assert.ok(!tabs.rows.some(row=>row.id===action.tab));inactiveClosed=true;event('inactive-close-ack');
   } else assert.equal(result.outcome,'rejected');
   pending.delete(attempt);
  } else if(action.kind==='activate'&&value.request>=attempt&&value.snapshot&&value.inputReady&&tabs.active===action.tab){
   condition='tab-switch-exact-session';assert.notEqual(action.previousTab,action.tab);assert.equal(value.selectedSession,tabSessions.get(action.tab),'wrong-tab-session');switched=true;event('tab-switch-live');pending.delete(attempt);
  } else if(action.kind==='active-close'&&value.request===attempt&&value.surface==='home'&&!tabs.rows.some(row=>row.id===action.tab)){
   condition='active-close-home';assert.equal(value.snapshot,null);assert.equal(value.inputReady,false);activeClosed=true;event('active-close-home');pending.delete(attempt);
  }
 }
 if(native&&!nativeResult&&!closing&&native.exitCode===null&&native.signalCode===null)write(native,line,32*1024*1024);
}
function command(value,line){
 condition='native-command-allowlist';
 assert.ok(++commands<=4096,'command-count-bound');
 if(value.type==='input'){
  condition='owned-resize-only';
  assert.equal(value.input?.kind,'resize','terminal-input-refused');resizeCount++;
  assert.equal(value.request,latest.request);assert.equal(value.id,latest.selectedPane);
 } else assert.ok(['appearance','presence','session','pane','fleet-session','session-tab','home','refresh'].includes(value.type),'command-out-of-scope');
 if(value.type==='session-tab'){
  const tabs=latest.sessionTabs;
  const row=tabs.rows.find(row=>row.activate===value.action||row.close===value.action);
  if(row){
   const kind=row.activate===value.action?'activate':tabs.active===row.id||tabs.pending===row.id?'active-close':'inactive-close';
   assert.ok(pending.size<64,'pending-command-bound');
   pending.set(value.request,{kind,tab:row.id,previousTab:tabs.active,fromRequest:value.fromRequest,revision:value.revision,action:value.action,session:latest.selectedSession,pane:latest.selectedPane});
  }
 }
 event(`command:${value.type}`);write(browser,line,65536);
}
function readLines(child,kind,limit,handle){
 child.stdout.on('data',chunk=>{try{
  buffers[kind]+=decoders[kind].write(chunk);let end;
  while((end=buffers[kind].indexOf('\n'))>=0){assert.ok(Buffer.byteLength(buffers[kind].slice(0,end))<=limit,'line-bound');const line=buffers[kind].slice(0,end+1);buffers[kind]=buffers[kind].slice(end+1);handle(JSON.parse(line),line);}
  assert.ok(Buffer.byteLength(buffers[kind])<=limit,'partial-line-bound');
 }catch(error){fail(`${condition}-failed`);}});
 child.stdout.on('end',()=>{buffers[kind]+=decoders[kind].end();if(buffers[kind])fail(`${kind}-partial-eof`);else if(kind==='browser'&&!closing&&!nativeResult)fail('browser-eof');});
}
try{
 condition='scratch-setup';
 fleet=await createScratchFleet({sessions:2,windowsPerSession:1,slug:'native-tabs-combined'});
 const canonical=join(fleet.root,'canonical'),tmp=join(fleet.root,'tmp');
 await mkdir(canonical,{mode:0o700});await mkdir(tmp,{mode:0o700});
 env={...process.env,...fleet.environment,TMUX:'',TMPDIR:tmp,TMUX_IDE_DAEMON_INFO_DIR:canonical,TMUX_IDE_REGISTRY_DIR:canonical,TMUX_IDE_TMUX_SOCKET_PATH:fleet.socketPath};delete env.TMUX_IDE_TMUX_SOCKET_NAME;
 before=source();
 daemon=own(spawn(node,[cli,'--headless'],{cwd:fleet.projectDir,env,stdio:['ignore','ignore','pipe']}),'daemon');
 condition='private-daemon-startup';
 await until(async()=>{try{const path=join(canonical,'daemon.json');assert.ok((await stat(path)).size<65536);record=JSON.parse(await readFile(path,'utf8'));return record.pid===daemon.pid;}catch{return false;}});
 browser=own(spawn(node,[browserEntry,'--local'],{cwd:fleet.root,env,stdio:['pipe','pipe','pipe']}),'browser');
 readLines(browser,'browser',8*1024*1024,publication);
 condition='browser-home-startup';
 await until(()=>latest?.surface==='home'&&latest.home?.phase==='live'&&latest.sessions?.length===2);
 native=own(spawn(binary,['--tmux-browser-stdio'],{cwd:fleet.root,env,stdio:['pipe','pipe','pipe']}),'native');
 readLines(native,'native',16384,command);
 write(native,latestLine,32*1024*1024);
 console.log(JSON.stringify({stage:'ready',nativePid:native.pid,private:true,instruction:'Activate this owned QA window. Open first session, then F6 open the other. Use F9 to switch retained tabs. Close the inactive tab with its close control, then Ctrl-F9 close active to Home. Wait for parent visual check, then Cmd-Q. No terminal typing/paste.'}));
 while(!nativeResult){check();await delay(25);}
 condition='native-successful-exit';
 assert.equal(nativeResult.code,0,'native-exit-not-zero');
 condition='two-real-accepted-tabs';
 assert.equal(tabSessions.size,2,'two-real-accepted-tabs-required');
 assert.equal(new Set(tabSessions.values()).size,2,'two-distinct-real-sessions-required');
 condition='completed-tab-journey';
 assert.ok(switched,'real-tab-switch-required');assert.ok(inactiveClosed,'inactive-close-ack-required');assert.ok(activeClosed,'active-close-home-required');
 condition='source-identity-preservation';
 assert.deepEqual(source(),before,'source-native-identities-changed');
} catch(error){errors.push(fatal?.message??`${condition}-failed`);}
finally{
 closing=true;let cleanupFailed=false;
 for(const [kind,child] of [['native',native],['browser',browser],['daemon',daemon]])try{await stopFixtureChild(child);}catch{cleanupFailed=true;errors.push(`${kind}-cleanup-failed`);}
 if(fleet){
  try{
   if(!env)env={...process.env,...fleet.environment};
   tmux('kill-server');
   if(!cleanupFailed){await rm(fleet.root,{recursive:true,force:true});rootRemoved=true;}
  }catch{errors.push('owned-server-cleanup-failed');}
 }
}
if(fatal&&!errors.includes(fatal.message))errors.push(fatal.message);
try{writeFileSync(out,JSON.stringify({passed:errors.length===0,canonicalDaemon:true,packagedBrowser:true,nativeUi:true,syntheticPublications:false,artifacts:hashes,twoAcceptedTabs:tabSessions.size===2,realTabSwitch:switched,inactiveClosePreservedTerminal:inactiveClosed,activeCloseReturnedHome:activeClosed,sourceBirthsPreserved:errors.length===0,inputSent:inputCount,ownedResizeCommands:resizeCount,publications,commands,diagnosticBytes,nativeResult,ownedCleanup:rootRemoved,trace,errors},null,2)+'\n',{flag:'wx',mode:0o600});}
finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
assert.deepEqual(errors,[]);
