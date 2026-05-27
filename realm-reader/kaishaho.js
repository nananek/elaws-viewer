const Realm = require('realm');
const path = require('path');
const work = path.resolve(__dirname, 'work.realm');

const LAW_NO = '平成十七年法律第八十六号'; // 会社法

const STYLE_MAP = {
  0:  ['marker','黄'],
  1:  ['marker','緑'],
  2:  ['marker','青'],
  3:  ['marker','赤'],
  4:  ['marker','紫'],
  5:  ['marker','オレンジ'],
  6:  ['marker','グレー(暗記隠し)'],
  7:  ['underline','黄'],
  8:  ['underline','緑'],
  9:  ['underline','青'],
  10: ['underline','赤'],
  11: ['underline','紫'],
  12: ['underline','オレンジ'],
  13: ['underline','グレー'],
};

function articleOf(anchor) {
  // anchor例: "条400/項1/文1" or "条555/頭"
  const m = anchor && anchor.match(/^条(\d+(?:_\d+)?)/);
  return m ? m[1] : '(?)';
}

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});
  const all = realm.objects('SelectionObject')
    .filtered('lawNo == $0 AND isDeleted == false', LAW_NO);

  console.log(`# 会社法（${LAW_NO}）ハイライト統計`);
  console.log(`総件数: ${all.length}`);

  // by style
  const byStyle = {};
  for (const s of all) byStyle[s.style] = (byStyle[s.style]||0)+1;
  console.log('\n## styleごと内訳');
  console.log('| style | 種別 | 色 | 件数 |');
  console.log('|---|---|---|---:|');
  for (const k of Object.keys(byStyle).sort((a,b)=>+a-+b)) {
    const [t,c] = STYLE_MAP[k] || ['?','?'];
    console.log(`| ${k} | ${t} | ${c} | ${byStyle[k]} |`);
  }

  // by article (top 20)
  const byArticle = {};
  for (const s of all) {
    const a = articleOf(s.startAnchor);
    byArticle[a] = (byArticle[a]||0)+1;
  }
  const articles = Object.entries(byArticle).sort((x,y)=>y[1]-x[1]);
  console.log(`\n## マーカー多い条文 TOP20（全${articles.length}条に分布）`);
  console.log('| 条 | 件数 |');
  console.log('|---|---:|');
  for (const [art, n] of articles.slice(0,20)) console.log(`| 第${art.replace('_','条の')}条 | ${n} |`);

  // by article × style (top 10 articles)
  console.log('\n## 上位10条の色別内訳');
  console.log('| 条 | 黄M | 緑M | 青M | 赤M | 紫M | 橙M | 灰M | 黄U | 緑U | 青U | 赤U | 紫U | 橙U | 灰U | 計 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const top = articles.slice(0,10);
  for (const [art] of top) {
    const counts = new Array(14).fill(0);
    for (const s of all) {
      if (articleOf(s.startAnchor) === art) counts[s.style]++;
    }
    const total = counts.reduce((a,b)=>a+b,0);
    console.log(`| 第${art.replace('_','条の')}条 | ${counts.join(' | ')} | ${total} |`);
  }

  // by month (createdAt distribution)
  const byMonth = {};
  for (const s of all) {
    const d = s.createdAt;
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    byMonth[k] = (byMonth[k]||0)+1;
  }
  console.log('\n## 作成時期（月別）');
  console.log('| 年月 | 件数 |');
  console.log('|---|---:|');
  for (const k of Object.keys(byMonth).sort()) console.log(`| ${k} | ${byMonth[k]} |`);

  // unique startStrings — top 10 most-marked phrases
  const phrases = {};
  for (const s of all) phrases[s.startString] = (phrases[s.startString]||0)+1;
  const topPhrases = Object.entries(phrases).filter(e=>e[1]>1).sort((a,b)=>b[1]-a[1]);
  if (topPhrases.length) {
    console.log('\n## 複数回マークした語句');
    console.log('| 語句 | 回数 |');
    console.log('|---|---:|');
    for (const [p, n] of topPhrases.slice(0,15)) console.log(`| ${p.replace(/\|/g,'｜')} | ${n} |`);
  }

  realm.close();
})().catch(e => { console.error(e); process.exit(1); });
