const Realm = require('realm');
const fs = require('fs');
const path = require('path');

const work = path.resolve(__dirname, 'work.realm');

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});

  console.log('=== TagEntity (color definitions) ===');
  for (const t of realm.objects('TagEntity').sorted('tagNumber')) {
    console.log(`  tag#${t.tagNumber}  color=${t.colorType}  order=${t.order}  title="${t.title}"  deleted=${t.isDeleted}`);
  }

  console.log('\n=== DownloadedLaw (counts per law) ===');
  for (const dl of realm.objects('DownloadedLaw')) {
    console.log(`  ${dl.lawNum}  ${dl.lawTitle}  filename=${dl.filename}`);
  }

  console.log('\n=== Counts ===');
  for (const cls of realm.schema) {
    console.log(`  ${cls.name}: ${realm.objects(cls.name).length}`);
  }

  console.log('\n=== Tag rows (per-anchor tag application) ===');
  // group by lawNo
  const byLaw = {};
  for (const t of realm.objects('Tag').filtered('isDeleted == false')) {
    byLaw[t.lawNo] = byLaw[t.lawNo] || {};
    byLaw[t.lawNo][t.tagNumber] = (byLaw[t.lawNo][t.tagNumber] || 0) + 1;
  }
  for (const [law, counts] of Object.entries(byLaw)) {
    console.log(`  lawNo=${law}: ${JSON.stringify(counts)}`);
  }

  console.log('\n=== SelectionObject per-lawNo with style breakdown ===');
  const sel = {};
  for (const s of realm.objects('SelectionObject').filtered('isDeleted == false')) {
    sel[s.lawNo] = sel[s.lawNo] || {};
    sel[s.lawNo][s.style] = (sel[s.lawNo][s.style] || 0) + 1;
  }
  for (const [law, counts] of Object.entries(sel)) {
    console.log(`  lawNo=${law}: styles=${JSON.stringify(counts)}`);
  }

  realm.close();
})().catch(e => { console.error(e); process.exit(1); });
