// Public evidence snapshots only; no upstream executable code is run.
import fs from 'node:fs';
import crypto from 'node:crypto';
const entries = [
  ['minmax-tilted-squares-in-circle.json', 'https://minmaxarena.com/data/tilted-squares-in-circle.json', 'CC-BY-4.0'],
  ['friedman-squincir.html', 'https://raw.githubusercontent.com/erich-friedman/erich-friedman.github.io/master/packing/squincir/index.html', 'unspecified; retained as research evidence'],
  ['friedman-squintri.html', 'https://raw.githubusercontent.com/erich-friedman/erich-friedman.github.io/master/packing/squintri/index.html', 'unspecified; retained as research evidence'],
  ['hyra-summary.csv', 'https://raw.githubusercontent.com/Tencent-Hunyuan/Hyra-results/main/AI4Science/packing_records/SUMMARY.csv', 'Apache-2.0'],
  ...[8,12,17,23,30].map(n=>[`friedman-squintri-${n}.gif`, `https://raw.githubusercontent.com/erich-friedman/erich-friedman.github.io/master/packing/squintri/ts${n}.gif`, 'unspecified; research figure for reconstruction'])
];
if (fs.existsSync('data/sources/manifest.json') && !process.argv.includes('--refresh')) {
  throw Error('Frozen snapshot already exists. Pass --refresh only before a new campaign; retain the previous snapshot with that campaign.');
}
fs.mkdirSync('data/sources',{recursive:true});
const out=[];
for (const [name,url,license] of entries) {
  const response=await fetch(url);
  if(!response.ok) throw Error(`${response.status}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(`data/sources/${name}`,bytes);
  out.push({path:`data/sources/${name}`,url,retrieved_at:new Date().toISOString(),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,license});
  console.log(name,bytes.length);
}
fs.writeFileSync('data/sources/manifest.json',JSON.stringify({schema_version:1,artifacts:out},null,2)+'\n');
