const Realm = require('realm');
const path = require('path');

(async () => {
  const r1 = await Realm.open({path: path.resolve(__dirname,'work.realm'), readOnly: true});
  const r2 = await Realm.open({path: path.resolve(__dirname,'work2.realm'), readOnly: true});

  const old = new Set();
  for (const s of r1.objects('SelectionObject')) old.add(s.uuid);

  const newKenpo = [];
  for (const s of r2.objects('SelectionObject')) {
    if (!old.has(s.uuid) && s.lawNo === '昭和二十一年憲法') {
      newKenpo.push(s);
    }
  }
  newKenpo.sort((a,b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.startIndexInRow - b.startIndexInRow;
  });

  console.log(`新規 憲法 SelectionObject: ${newKenpo.length}件\n`);
  console.log('| # | row | startIdx | style | startStr | endStr | startAnchor | endAnchor | created |');
  console.log('|---:|---:|---:|---:|---|---|---|---|---|');
  newKenpo.forEach((s,i)=>{
    const t = s.createdAt.toISOString().replace('T',' ').slice(0,19);
    console.log(`| ${i+1} | ${s.row} | ${s.startIndexInRow} | ${s.style} | ${s.startString||''} | ${s.endString||''} | ${s.startAnchor} | ${s.endAnchor} | ${t} |`);
  });

  r1.close(); r2.close();
})().catch(e=>{console.error(e);process.exit(1);});
