import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
const home = await mkdtemp('/tmp/tmi-retry-render-');
const env = {...process.env, HOME:home, XDG_CONFIG_HOME:home};
for (const key of Object.keys(env)) if (key.startsWith('TMUX') || key === 'NODE_OPTIONS' || key === 'NODE_PATH') delete env[key];
const child = spawn('/tmp/Tmux IDE Retry QA.app/Contents/MacOS/tmux-ide-gpui', ['--tmux-browser-stdio'], {env, stdio:['pipe','pipe','inherit']});
const msg = JSON.parse(await readFile('apps/tmux-gpui/fixtures/browser-fleet.json','utf8'));
msg.status='Isolated presentation fixture — no SSH connection';
msg.fleet.groups = [{id:'retry-fixture',label:'Build machine',state:'disconnected',conflict:false,retry:'fe470cdc-82bb-48d5-8fc4-1fa68025c8e4',omittedSessions:0,sessions:[]}];
let sequence = 0;
const send = () => child.stdin.write(JSON.stringify({...msg,sequence:++sequence})+'\n');
const commands = [];
createInterface({input:child.stdout}).on('line', line => {
 const cmd=JSON.parse(line);commands.push(cmd);
 if(cmd.type==='presence') {msg.presenceRevision=cmd.revision;send();}
});
child.stdin.on('error',()=>{});
send();
console.log('NATIVE_PID='+child.pid);
const stop=()=>child.kill('SIGTERM');
process.on('SIGTERM',stop);process.on('SIGINT',stop);
const timer=setTimeout(stop,600000);
await new Promise(resolve=>child.once('exit',resolve));
clearTimeout(timer);
await writeFile('.tasks/gpui-fleet-retry/commands.json',JSON.stringify(commands,null,2));
await rm(home,{recursive:true,force:true});
