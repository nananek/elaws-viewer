const Realm = require('realm');
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, 'catalystwo-dump.realm');
const work = path.resolve(__dirname, 'catalystwo-work.realm');
try { fs.copyFileSync(src, work); } catch (e) { console.error('copy fail:', e.message); process.exit(1); }

(async () => {
  // Open WITHOUT specifying a schema → Realm uses the file's own schema
  const r = await Realm.open({ path: work });
  console.log('Schema version on disk:', r.schemaVersion);
  console.log('\n=== Classes ===');
  for (const cls of r.schema) {
    const count = r.objects(cls.name).length;
    console.log(`\n  ${cls.name}  pk=${cls.primaryKey || '-'}  count=${count}`);
    for (const [k, v] of Object.entries(cls.properties)) {
      console.log(`    ${k}: ${JSON.stringify(v)}`);
    }
  }

  // Dump sample rows for organization-related classes
  for (const klass of ['Organizable', 'DownloadedLaw', 'FolderEntity', 'Folder', 'Tag', 'TagEntity']) {
    if (!r.schema.find(c => c.name === klass)) continue;
    console.log(`\n=== Sample rows: ${klass} ===`);
    let i = 0;
    for (const row of r.objects(klass)) {
      if (i++ >= 30) { console.log('  ... (truncated)'); break; }
      const flat = {};
      for (const [k, v] of Object.entries(row)) {
        if (v && typeof v === 'object' && v.constructor.name === 'Object') continue;
        if (v && typeof v === 'object' && v instanceof Date) flat[k] = v.toISOString();
        else if (typeof v === 'string' && v.length > 80) flat[k] = v.slice(0, 80) + '…';
        else flat[k] = v;
      }
      console.log(' ', JSON.stringify(flat));
    }
  }

  r.close();
  fs.unlinkSync(work);
})().catch(e => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
