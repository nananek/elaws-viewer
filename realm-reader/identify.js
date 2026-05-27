const Realm = require('realm');
const path = require('path');
const work = path.resolve(__dirname, 'work.realm');

function article(anchor) {
  const m = anchor && anchor.match(/^条(\d+(?:_\d+)?)/);
  return m ? m[1].replace('_','条の') : '?';
}

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});
  const all = realm.objects('SelectionObject').filtered('isDeleted == false');

  // Group by style globally
  const byStyle = {};
  for (const s of all) {
    byStyle[s.style] = byStyle[s.style] || [];
    byStyle[s.style].push(s);
  }

  const lawTitle = {};
  for (const dl of realm.objects('DownloadedLaw')) lawTitle[dl.lawNum] = dl.lawTitle;

  console.log('# style識別用サンプル一覧（不明styleのみ）\n');
  const knownLabels = {
    0: '黄マーカー (確定)',
    6: '青下線 (確定)',
    8: '黄下線 (確定)',
  };

  for (const k of Object.keys(byStyle).sort((a,b)=>+a-+b)) {
    if (knownLabels[k]) {
      console.log(`## style=${k}  ${knownLabels[k]}  ${byStyle[k].length}件 — 省略\n`);
      continue;
    }
    const rows = byStyle[k];
    console.log(`## style=${k}  (?)  ${rows.length}件`);
    console.log('| # | 法令 | 条 | startString |');
    console.log('|---:|---|---|---|');
    // Show up to 8 samples spread across distinct laws / articles
    const seen = new Set();
    let shown = 0;
    for (const s of rows) {
      const key = `${s.lawNo}/${article(s.startAnchor)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const t = lawTitle[s.lawNo] || s.lawNo;
      const txt = (s.startString||'').replace(/\|/g,'｜').slice(0,40);
      console.log(`| ${shown+1} | ${t} | 第${article(s.startAnchor)}条 | ${txt} |`);
      shown++;
      if (shown >= 8) break;
    }
    console.log('');
  }

  realm.close();
})().catch(e => { console.error(e); process.exit(1); });
