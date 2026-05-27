const Realm = require('realm');
const path = require('path');
const work = path.resolve(__dirname, 'work.realm');

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});
  const kenpo = realm.objects('SelectionObject')
    .filtered('lawNo == "昭和二十一年憲法" AND isDeleted == false')
    .sorted('row');
  console.log(`憲法のSelectionObject ${kenpo.length}件\n`);
  for (const s of kenpo) {
    console.log(`style=${s.style}  row=${s.row}  startIdx=${s.startIndexInRow}  startAnchor=${s.startAnchor}  endAnchor=${s.endAnchor}`);
    console.log(`  startString="${s.startString}"  endString="${s.endString}"  occIdx=${s.startStringOccurrenceIndex}`);
  }
  realm.close();
})().catch(e=>{console.error(e); process.exit(1);});
