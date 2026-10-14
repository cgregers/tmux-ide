import os, subprocess, pathlib, json, time
root=pathlib.Path(__file__).resolve().parents[2]
out=pathlib.Path(__file__).resolve().parent
env=dict(os.environ, CARGO_HOME='/private/tmp/tmux-gpui-toolchain/cargo', RUSTUP_HOME='/private/tmp/tmux-gpui-toolchain/rustup', CARGO_BUILD_JOBS='1', CARGO_INCREMENTAL='0', HERDR_BUILD_PR_NUMBER='')
env['PATH']='/private/tmp/tmux-gpui-toolchain/cargo/bin:'+env['PATH']
checks=[('format',['cargo','fmt','--all','--','--check']),('size',['bash','scripts/check-file-size.sh']),('clippy-all',['cargo','clippy','--locked','--workspace','--all-targets','--all-features','--','-D','warnings']),('clippy-minimal',['cargo','clippy','--locked','--workspace','--all-targets','--no-default-features','--','-D','warnings']),('test-default',['cargo','test','--locked','--workspace']),('test-all',['cargo','test','--locked','--workspace','--all-features'])]
results=[]
for name,cmd in checks:
    print('Starting '+name,flush=True)
    started=time.time()
    with (out/(name+'.log')).open('w') as log:
        result=subprocess.run(cmd,cwd=root/'apps/tmux-gpui/upstream',env=env,stdout=log,stderr=subprocess.STDOUT)
    results.append(dict(name=name,command=cmd,exitCode=result.returncode,seconds=round(time.time()-started,2)))
    (out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(name+' exit '+str(result.returncode),flush=True)
    if result.returncode:raise SystemExit(result.returncode)
