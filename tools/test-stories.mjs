import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baliDate, nextStoryDate } from './story-schedule.mjs';
import { validatedEdition, repeatedSentenceOpening } from './story-quality.mjs';
import { requestCeiling, checkBudget } from './story-budget.mjs';
import { validate } from './story-gen.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Bali midnight and stale September archive queue a future Thursday', () => {
  assert.equal(baliDate(new Date('2026-11-04T16:01:00Z')), '2026-11-05');
  assert.equal(nextStoryDate([{ date: '2026-09-24' }], new Date('2026-11-05T01:00:00Z')), '2026-11-12');
  assert.equal(nextStoryDate([{ date: '2026-11-12' }, { date: '2026-11-26' }], new Date('2026-11-05T01:00:00Z')), '2026-11-19');
  assert.equal(nextStoryDate([], new Date('2026-12-31T01:00:00Z')), '2027-01-07');
});

test('retry keeps accepted languages and passes failures only to the rejected writer', async () => {
  const calls = [], result = {};
  for (const lang of ['en', 'ru', 'id']) {
    result[lang] = await validatedEdition({
      label: lang,
      write: async feedback => { calls.push({ lang, feedback }); return lang === 'ru' && !feedback.length ? 'bad' : 'good'; },
      check: value => value === 'bad' ? ['RU: missing бранч'] : [],
    });
  }
  assert.deepEqual(calls.map(c => c.lang), ['en', 'ru', 'ru', 'id']);
  assert.deepEqual(calls[2].feedback, ['RU: missing бранч']);
  assert.equal(result.ru, 'good');
});

test('quality rejection is bounded; operational errors are never paid retries', async () => {
  let count = 0;
  await assert.rejects(validatedEdition({ label: 'ru', write: async () => ++count, check: () => ['bad prose'] }), /after 2 attempts/);
  assert.equal(count, 2);
  count = 0;
  await assert.rejects(validatedEdition({ label: 'ru', write: async () => { count++; throw Error('network'); }, check: () => [] }), /network/);
  assert.equal(count, 1);
});

test('ordinary English articles pass; actual repetitive openings still fail', () => {
  assert.equal(repeatedSentenceOpening([{ p: ['The cake is flaky. The filling is sweet. The menu lists a portion.'] }]), null);
  assert.equal(repeatedSentenceOpening([{p:['Если творог сухой. Если муки много. Если жар сильный.']}], 'ru'), 'если');
  assert.equal(repeatedSentenceOpening([{ p: ['This dish is flaky. This dish is sweet. This dish is on the menu.'] }]), 'this');
});

test('Russian language and cringe gates remain active', () => {
  const post = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stories.json'))).posts.find(p => p.ru);
  const changed = structuredClone(post);
  changed.ru.blocks[0].p.push('Моя оценка: breakfast является вкусным.');
  const issues = validate(changed, ['ru']);
  assert(issues.some(x => x.includes('pseudo-literary filler')));
  assert(issues.some(x => x.includes('english words')));
  assert(issues.some(x => x.includes('dead construction')));
});

test('the worst possible next response is reserved inside day/month/run limits', () => {
  const ceiling = requestCeiling({ messages: [{ content: 'Привет' }], jsonSchema: {}, maxTokens: 16000, model: 'gpt-5.5', rates: { models: { 'gpt-5.5': { input: 5, output: 30 } } } });
  assert(ceiling > .48);
  const base = { ceiling, daySpent: 0, monthSpent: 0, runSpent: 0, dailyCap: 3, monthlyCap: 10, runCap: 5 };
  checkBudget(base);
  assert.throws(() => checkBudget({ ...base, monthSpent: 9.9 }), /monthly budget/);
  assert.throws(() => checkBudget({ ...base, daySpent: 2.9 }), /daily budget/);
  assert.throws(() => checkBudget({ ...base, runSpent: 4.9 }), /run budget/);
  assert.throws(() => checkBudget({ ...base, monthlyCap: NaN }), /invalid/);
  assert.throws(() => requestCeiling({ messages: [], jsonSchema: {}, maxTokens: 100, model: 'unknown', rates: {} }), /no verified price/);
});

test('corrupt ledger fails closed, while response ID bookkeeping is idempotent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signa-ledger-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'tools'));
    fs.mkdirSync(path.join(dir, 'data'));
    fs.copyFileSync(path.join(ROOT, 'tools/cost-ledger.mjs'), path.join(dir, 'tools/cost-ledger.mjs'));
    fs.copyFileSync(path.join(ROOT, 'data/model-pricing.json'), path.join(dir, 'data/model-pricing.json'));
    const ledger = path.join(dir, 'data/story-costs.json');
    fs.writeFileSync(ledger, '{bad');
    assert.throws(() => execFileSync(process.execPath, ['--input-type=module', '-e', 'import {spentOn} from "./tools/cost-ledger.mjs"; spentOn();'], { cwd: dir, stdio: 'pipe' }));
    fs.writeFileSync(ledger, '{"runs":[]}');
    execFileSync(process.execPath, ['--input-type=module', '-e', `import {record} from './tools/cost-ledger.mjs'; const r={model:'gpt-5.5',stage:'test',responseId:'same-response',usage:{input_tokens:100,output_tokens:100}};record(r);record(r);`], { cwd: dir });
    assert.equal(JSON.parse(fs.readFileSync(ledger)).runs.length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('generator lock excludes another process, then releases cleanly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signa-lock-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'tools'));
    fs.copyFileSync(path.join(ROOT, 'tools/story-runtime.mjs'), path.join(dir, 'tools/story-runtime.mjs'));
    execFileSync(process.execPath, ['--input-type=module', '-e', `import {lockGenerator} from './tools/story-runtime.mjs';import{execFileSync}from'node:child_process';const release=lockGenerator();let blocked=false;try{execFileSync(process.execPath,['--input-type=module','-e','import {lockGenerator} from "./tools/story-runtime.mjs";lockGenerator();'],{stdio:'pipe'});}catch{blocked=true;}if(!blocked)throw Error('second writer acquired lock');release();lockGenerator()();`], { cwd: dir });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});


test('pending paid result cannot be overwritten or cleared by an older request', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'signa-pending-test-'));
  try {
    fs.mkdirSync(path.join(dir,'tools'));
    fs.copyFileSync(path.join(ROOT,'tools/story-runtime.mjs'),path.join(dir,'tools/story-runtime.mjs'));
    execFileSync(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';import{savePending,pendingResponse,clearPending,assertNoPending}from'./tools/story-runtime.mjs';savePending({requestId:'new',id:'response'});assert.throws(assertNoPending,/unresolved/);clearPending('old');assert.equal(pendingResponse().id,'response');clearPending('new');assertNoPending();`],{cwd:dir});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('failure message preview works even with corrupt story data and no credentials', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'signa-notify-test-'));
  try {
    fs.mkdirSync(path.join(dir,'tools'));fs.mkdirSync(path.join(dir,'data'));
    for(const f of ['notify-telegram.mjs','gbp-post.mjs','og-images.mjs','story-network.mjs','story-schedule.mjs'])fs.copyFileSync(path.join(ROOT,'tools',f),path.join(dir,'tools',f));
    fs.writeFileSync(path.join(dir,'data/stories.json'),'{broken');
    const result=execFileSync(process.execPath,['tools/notify-telegram.mjs','--failure','тест','--dry-run'],{cwd:dir,encoding:'utf8'});
    assert.match(result,/сбой еженедельных историй/);
    assert.equal(fs.existsSync(path.join(dir,'.story-runtime')),false);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
