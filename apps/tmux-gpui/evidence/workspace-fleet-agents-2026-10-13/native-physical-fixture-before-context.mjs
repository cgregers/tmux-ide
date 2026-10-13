// Local visual-only fixture: never discovers or connects to a daemon.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stopFixtureChild} from '../../apps/tmux-gpui/bridge/fixture-child.mjs';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,stat,access} from 'node:fs/promises';
import {writeFileSync,constants,existsSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
const [binary,out]=process.argv.slice(2);
assert.ok(binary&&out&&isAbsolute(binary)&&isAbsolute(out));
assert.ok((await stat(binary)).isFile());
await access(binary,constants.X_OK);assert.ok(!existsSync(out),'Use a fresh receipt path');
const state=JSON.parse(await readFile(new URL('../../apps/tmux-gpui/fixtures/browser-initial.json',import.meta.url),'utf8'));
const binarySha256=createHash('sha256').update(await readFile(binary)).digest('hex');
const snapshot=JSON.parse(await readFile(new URL('../../apps/tmux-gpui/fixtures/snapshot.json',import.meta.url),'utf8'));
let active=false,sequence=1,scenario=0;
const historyCommands=[];
const agentA={key:'agent-a',sessionId:'session-a',paneId:'pane-a',name:'Duplicate agent',sessionLabel:'Session A',machineLabel:'Machine A',serverLabel:'Server A',status:'WORKING',attention:false,available:true};
const agentB={key:'agent-b',sessionId:'session-b',paneId:'pane-b',name:'Duplicate agent',sessionLabel:'Session B',machineLabel:'Machine B',serverLabel:'Server B',status:'BLOCKED',attention:true,available:true};
Object.assign(state,{connection:'synthetic-workspace-fleet-agents',surface:'workspace',home:{phase:'live'},createSession:null,sessions:[{id:'session-a',label:'Session A',paneCount:1}],selectedSession:'session-a',selectedPane:'pane-a',panes:[{id:'pane-a',label:'Current A pane',windowId:'window-a',windowLabel:'Current A window'}],snapshot,regions:[{id:'pane-a',left:0,top:0,width:snapshot.cols,height:snapshot.rows}],inputReady:false,sessionCatalogComplete:false,preferredPane:null,status:'Select Duplicate agent on Machine B in the fleet sidebar.',fleet:null,homeAgents:null,workspaceAgents:null,sessionHistory:null,sessionHistoryRejected:null,workspaceFleetAgentRejected:null,workspaceFleetAgents:{request:0,scope:1,revision:1,phase:'live',rows:[agentA,agentB],observedSessions:2,totalSessions:3,truncatedSessions:1,truncatedRows:0,note:'One session remains unobserved.',selectedKey:'agent-a'}});
state.appearance.selected='dark';
const home=await mkdtemp('/private/tmp/gpui-session-history-home-');
let child,timer,buffer='',stderr='',total=0,result;
const decoder=new StringDecoder('utf8'),commands=[],errors=[];
let rejectFatal,firstFailure;
const fatal=new Promise((_,reject)=>{rejectFatal=reject;}); fatal.catch(()=>{});
const fail=e=>{firstFailure??=e instanceof Error?e:new Error(e);rejectFatal(firstFailure);};
const publish=()=>{if(firstFailure)return;state.sequence=++sequence;assert.ok(child.stdin.writableLength<1024*1024,'Synthetic publication backlog');child.stdin.write(JSON.stringify(state)+'\n');};
const accept=command=>{
 if(command.type==='appearance'){
  assert.deepEqual(Object.keys(command).sort(),['system','type']);
  assert.ok(command.system==='dark'||command.system==='light','Invalid OS appearance');
  state.appearance.system=command.system;publish();return;
 }
 if(command.type==='presence') {assert.deepEqual(Object.keys(command).sort(),['active','revision','type']);assert.equal(typeof command.active,'boolean');assert.ok(Number.isSafeInteger(command.revision)&&command.revision>=state.presenceRevision);active=command.active;state.presenceRevision=command.revision;state.inputReady=false;publish();return;}
 if(command.type==='open-workspace-fleet-agent'){
  assert.ok(active);assert.equal(scenario,0);
  assert.deepEqual(Object.keys(command).sort(),['fromRequest','key','request','rosterRevision','scope','type']);
  assert.equal(command.key,'agent-b');assert.equal(command.fromRequest,state.request);
  assert.equal(command.scope,state.workspaceFleetAgents.scope);
  assert.equal(command.rosterRevision,state.workspaceFleetAgents.revision);
  assert.ok(command.request>state.request);historyCommands.push(command);
  state.request=command.request;state.selectedSession='session-b';state.selectedPane='pane-b';
  state.sessions=[{id:'session-b',label:'Accepted Session B',paneCount:1}];
  state.panes=[{id:'pane-b',label:'Accepted Machine B pane',windowId:'window-b',windowLabel:'Accepted Machine B window'}];
  state.regions=[{id:'pane-b',left:0,top:0,width:snapshot.cols,height:snapshot.rows}];
  state.workspaceFleetAgents={...state.workspaceFleetAgents,request:command.request,scope:2,revision:2,selectedKey:'agent-b'};
  scenario=1;state.status='Exact Machine B agent accepted; verify then Cmd-Q.';publish();return;
 }
 assert.fail('Unexpected synthetic fixture command type');
};
const cancel=()=>fail('Visual fixture cancelled');
process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
try {
 child=spawn(binary,['--tmux-browser-stdio'],{cwd:home,env:{HOME:home,TMPDIR:home,PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'},stdio:['pipe','pipe','pipe']});
 const closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});
 child.stdin.on('error',fail);
 child.stdout.on('data',chunk=>{
  try {
   total+=chunk.length;assert.ok(total<=1024*1024,'Native output limit');
   buffer+=decoder.write(chunk);let end;
   while((end=buffer.indexOf('\n'))>=0){
    assert.ok(end<=8192&&commands.length<1024,'Native command bound');
    const command=JSON.parse(buffer.slice(0,end));commands.push(command);buffer=buffer.slice(end+1);accept(command);
   }
   assert.ok(buffer.length<=8192,'Native partial command bound');
  }catch(e){fail(e);}
 });
 child.stdout.on('error',fail);child.stderr.on('error',fail);
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-16384);});
 timer=setTimeout(()=>fail('Visual fixture deadline'),600000);
 child.stdin.write(JSON.stringify(state)+'\n');
 console.log(JSON.stringify({stage:'spawned',pid:child.pid,binarySha256,instruction:'Activate with Ctrl-G; select the second Duplicate agent, Machine B. Verify accepted B title/window/pane and authoritative selected row. Cmd-Q. No terminal input.'}));
 result=await Promise.race([closed,fatal]);
 buffer+=decoder.end();assert.equal(buffer,'','Truncated native command');
 assert.equal(result.code,0,stderr);
 assert.equal(scenario,1,'Cross-machine agent selection required');assert.equal(historyCommands.length,1);
 assert.ok(!commands.some(c=>c.type==='input'),'No terminal input or resize permitted');
}catch(e){errors.push(e.message);}finally{
 clearTimeout(timer);
 try{await stopFixtureChild(child);}catch(e){errors.push('Child cleanup: '+e.message);}
 if(!child||child.exitCode!==null||child.signalCode!==null){try{await rm(home,{recursive:true,force:true});}catch(e){errors.push('Home cleanup: '+e.message);}}
 else errors.push('Owned child still live; private home preserved: '+home);
}
if(firstFailure&&!errors.includes(firstFailure.message))errors.push(firstFailure.message);
try{writeFileSync(out,JSON.stringify({passed:errors.length===0,syntheticOnly:true,realDaemon:false,tmux:false,nativeUi:true,binary,binarySha256,scenario,historyCommands,acceptedPublicationSent:scenario===1,acceptedPublicationVisuallyVerified:false,commands,result,stderr,errors},null,2)+'\n',{flag:'wx',mode:0o600});}finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
assert.deepEqual(errors,[]);
