const Realm = require('realm');
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../data.bin');
// Realm wants a writable copy with .realm extension in some versions
const work = path.resolve(__dirname, 'work.realm');
fs.copyFileSync(src, work);

(async () => {
  try {
    const realm = await Realm.open({path: work, readOnly: true});
    console.log('Schema version:', realm.schemaVersion);
    console.log('Tables:');
    for (const cls of realm.schema) {
      console.log(`  ${cls.name}  pk=${cls.primaryKey || '-'}`);
      for (const [k, v] of Object.entries(cls.properties)) {
        console.log(`    ${k}: ${JSON.stringify(v)}`);
      }
    }
    realm.close();
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
})();
