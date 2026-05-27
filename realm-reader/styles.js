const Realm = require('realm');
const path = require('path');
const work = path.resolve(__dirname, 'work.realm');

(async () => {
  const realm = await Realm.open({path: work, readOnly: true});
  const all = realm.objects('SelectionObject').filtered('isDeleted == false');

  let total = 0, withAttr = 0, withEmbed = 0, withNotes = 0, withEnd = 0;
  const styleCount = {};
  for (const s of all) {
    total++;
    if (s.attributedString) withAttr++;
    if (s.embeddedObject) withEmbed++;
    if (s.notes) withNotes++;
    if (s.endString && s.endString !== s.startString) withEnd++;
    styleCount[s.style] = (styleCount[s.style] || 0) + 1;
  }
  console.log(`total=${total} withAttributedString=${withAttr} withEmbeddedObject=${withEmbed} withNotes=${withNotes} withDistinctEnd=${withEnd}`);
  console.log('Global style distribution:', JSON.stringify(styleCount));

  // Dump a couple of attributedString hex if any exist
  let dumped = 0;
  for (const s of all) {
    if (s.attributedString && dumped < 3) {
      const buf = Buffer.from(s.attributedString);
      console.log(`\nstyle=${s.style} attrStr len=${buf.length}`);
      console.log(buf.toString('hex').match(/.{1,64}/g).join('\n'));
      dumped++;
    }
  }
  // Same for embeddedObject
  dumped = 0;
  for (const s of all) {
    if (s.embeddedObject && dumped < 3) {
      const buf = Buffer.from(s.embeddedObject);
      console.log(`\nstyle=${s.style} embed len=${buf.length} startString="${s.startString}"`);
      console.log(buf.toString('hex').match(/.{1,64}/g).join('\n'));
      dumped++;
    }
  }

  realm.close();
})().catch(e => { console.error(e); process.exit(1); });
