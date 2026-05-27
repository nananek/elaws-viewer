const Realm = require('realm');
const path = require('path');
const work = path.resolve(__dirname, 'work.realm');

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});
  const minpo = realm.objects('SelectionObject')
    .filtered('lawNo == "明治二十九年法律第八十九号" AND isDeleted == false');

  // Get one sample per style
  const samples = {};
  for (const s of minpo) {
    if (!samples[s.style]) samples[s.style] = s;
  }
  for (const [style, s] of Object.entries(samples).sort((a,b)=>+a[0]-+b[0])) {
    console.log(`\n=== style=${style} ===`);
    console.log(`startString="${s.startString}"  endString="${s.endString}"`);
    console.log(`anchor=${s.startAnchor}..${s.endAnchor}`);
    console.log(`notes=${s.notes}`);
    if (s.attributedString) {
      const buf = Buffer.from(s.attributedString);
      console.log(`attributedString len=${buf.length}  head=${buf.slice(0,16).toString('hex')}  magic="${buf.slice(0,8).toString('ascii').replace(/[^\x20-\x7e]/g,'.')}"`);
    } else {
      console.log('attributedString = null');
    }
    if (s.embeddedObject) {
      const buf = Buffer.from(s.embeddedObject);
      console.log(`embeddedObject len=${buf.length}  head=${buf.slice(0,16).toString('hex')}`);
    }
  }

  realm.close();
})().catch(e => { console.error(e); process.exit(1); });
