// Offline integration test: real Git with a local bare remote, fake generation,
// deployment and Telegram. No API key, paid call, FTP or message is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('weekly rerun reuses queued article; failed generation persists costs and alerts', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signa-cron-test-'));
  const repo = path.join(temp, 'repo'), remote = path.join(temp, 'remote.git'), bin = path.join(temp, 'bin');
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  const write = (name, body) => { const dest=path.join(repo,name); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,body,{mode:0o755}); };
  try {
    fs.mkdirSync(repo); fs.mkdirSync(bin);
    // macOS lacks the Linux flock CLI; same inherited-descriptor locking syscall.
    if (spawnSync('flock', ['--version']).error) {
      const python = execFileSync('which', ['python3'], {encoding:'utf8'}).trim();
      fs.writeFileSync(path.join(bin,'flock'), `#!${python}\nimport fcntl,sys\ntry: fcntl.flock(int(sys.argv[-1]),fcntl.LOCK_EX|fcntl.LOCK_NB)\nexcept BlockingIOError: sys.exit(1)\n`, {mode:0o755});
    }
    execFileSync('git', ['init','--bare',remote], {stdio:'pipe'});
    git('init','-b','main'); git('config','user.name','test'); git('config','user.email','test@example.invalid');
    git('remote','add','origin',remote);
    write('.gitignore','.story-runtime/\ncount\nsent\ndeploys\nfail\nog-fail\n');
    write('data/stories.json','{"posts":[]}'); write('data/story-costs.json','{"runs":[]}');
    fs.mkdirSync(path.join(repo, 'assets/stories'), { recursive: true });
    write('tools/cron-weekly.sh',fs.readFileSync(path.join(ROOT,'tools/cron-weekly.sh')));
    write('tools/story-schedule.mjs',fs.readFileSync(path.join(ROOT,'tools/story-schedule.mjs')));
    write('tools/story-gen.mjs',`import fs from 'node:fs'; const n=Number(fs.existsSync('count')?fs.readFileSync('count'):0)+1;fs.writeFileSync('count',String(n));if(fs.existsSync('fail')){fs.writeFileSync('data/story-costs.json','{"runs":[{"usd":0.12}]}');console.error('FAILED: rejected text');process.exit(1)}const args=process.argv;const date=args[args.indexOf('--date')+1];fs.writeFileSync('assets/stories/test.webp','fixture');fs.writeFileSync('data/stories.json',JSON.stringify({posts:[{date,slug:'test-story',cover:'assets/stories/test.webp'}]}));`);
    write('tools/og-images.mjs',"import fs from 'node:fs';if(fs.existsSync('og-fail'))process.exit(1);");
    write('tools/notify-telegram.mjs',`import fs from 'node:fs';fs.appendFileSync('sent',process.argv.slice(2).join(' ')+'\\n');`);
    write('tools/deploy-stories.sh','#!/bin/bash\nprintf "%s\\n" "$*" >> deploys\n');
    git('add','.');git('commit','-qm','initial');git('push','-qu','origin','main');
    const env={...process.env,SIGNA_REPO:repo,PATH:bin+':'+process.env.PATH};
    const run=()=>spawnSync('bash',['tools/cron-weekly.sh'],{cwd:repo,env,encoding:'utf8',timeout:25000});
    write('og-fail','1');let r=run();assert.equal(r.status,1,r.stdout+r.stderr);fs.unlinkSync(path.join(repo,'og-fail'));
    assert.equal(git('diff','--name-only','--','data/stories.json').toString().trim(),'data/stories.json');
    r=run();assert.equal(r.status,0,r.stdout+r.stderr);
    assert.equal(git('diff','--name-only','--','data/stories.json').toString().trim(),'');
    r=run();assert.equal(r.status,0,r.stdout+r.stderr);
    assert.equal(fs.readFileSync(path.join(repo,'count'),'utf8'),'1','rerun generated an extra article');
    assert.match(r.stdout,/already prepared/);
    write('data/stories.json','{"posts":[]}');git('add','data/stories.json');git('commit','-qm','remove fixture');git('push','-q','origin','main');
    write('fail','1');r=run();assert.equal(r.status,1,r.stdout+r.stderr);
    assert.match(fs.readFileSync(path.join(repo,'sent'),'utf8'),/--failure генерация истории EN\/RU\/ID/);
    assert.match(fs.readFileSync(path.join(repo,'deploys'),'utf8'),/--costs-only/);
    assert.equal(git('diff','--name-only','--','data/story-costs.json').toString().trim(),'');
    assert.match(git('log','-1','--format=%s').toString(),/record failed generation costs/);
    write('wip.txt','unrelated');git('add','wip.txt');write('data/story-costs.json','{"runs":[{"usd":0.13}]}');r=run();assert.equal(r.status,1,r.stdout+r.stderr);assert.equal(git('diff','--cached','--name-only').toString().trim(),'wip.txt');assert(!git('ls-tree','--name-only','HEAD').toString().includes('wip.txt'));assert.equal(git('diff','--name-only','--','data/story-costs.json').toString().trim(),'');
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
