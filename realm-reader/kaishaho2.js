const Realm = require('realm');
const path = require('path');
const work = path.resolve(__dirname, 'work.realm');

const LAW_NO = '平成十七年法律第八十六号';

const STYLE_MAP = {
  0:  '黄マーカー',
  1:  '？',
  2:  '？',
  3:  '？',
  6:  '青下線',
  7:  '？',
  8:  '黄下線',
  10: '？',
  11: '？',
  13: '？(描画)',
};

function article(anchor) {
  const m = anchor && anchor.match(/^条(\d+(?:_\d+)?)/);
  return m ? m[1].replace('_','条の') : '?';
}

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});
  const all = realm.objects('SelectionObject')
    .filtered('lawNo == $0 AND isDeleted == false', LAW_NO)
    .sorted('createdAt');

  console.log(`# 会社法（${LAW_NO}） 全${all.length}件\n`);

  // group by style and list all
  const byStyle = {};
  for (const s of all) {
    byStyle[s.style] = byStyle[s.style] || [];
    byStyle[s.style].push(s);
  }

  for (const k of Object.keys(byStyle).sort((a,b)=>+a-+b)) {
    const rows = byStyle[k];
    console.log(`## style=${k}  [${STYLE_MAP[k]}]  ${rows.length}件`);
    // For known: just count by article. For unknown: list every example.
    if (STYLE_MAP[k] === '？' || STYLE_MAP[k].startsWith('？')) {
      console.log('| # | 条 | startString | endString | row | created |');
      console.log('|---:|---|---|---|---:|---|');
      rows.forEach((s,i) => {
        const created = s.createdAt.toISOString().slice(0,10);
        const start = (s.startString||'').replace(/\|/g,'｜').slice(0,40);
        const end = (s.endString||'').replace(/\|/g,'｜').slice(0,40);
        console.log(`| ${i+1} | 第${article(s.startAnchor)}条 | ${start} | ${end} | ${s.row} | ${created} |`);
      });
    } else {
      // known style: show article distribution
      const arts = {};
      for (const s of rows) arts[article(s.startAnchor)] = (arts[article(s.startAnchor)]||0)+1;
      const sorted = Object.entries(arts).sort((a,b)=>b[1]-a[1]);
      console.log(`  上位条: ${sorted.slice(0,8).map(([a,n])=>`第${a}条(${n})`).join(', ')}${sorted.length>8?` …他${sorted.length-8}条`:''}`);
    }
    console.log('');
  }

  realm.close();
})().catch(e => { console.error(e); process.exit(1); });
