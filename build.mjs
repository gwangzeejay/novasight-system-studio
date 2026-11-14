import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await build({entryPoints:['src/app.mjs'], bundle:true, minify:true, format:'iife', target:'es2020', outfile:'dist/studio.js'});
await writeFile('dist/style.css',(await readFile('src/style.css','utf8'))+'\n'+(await readFile('src/lab.css','utf8')));
await copyFile('src/index.html','dist/index.html');
for(const name of ['font-regular.ttf','font-semibold.ttf','OFL.txt'])await copyFile('src/'+name,'dist/'+name);
// Standalone file keeps the exact same application usable without a web server.
const js = await readFile('dist/studio.js','utf8');
let css = await readFile('dist/style.css','utf8');
for(const name of ['font-regular.ttf','font-semibold.ttf'])css=css.replace('./'+name,'data:font/ttf;base64,'+(await readFile('src/'+name)).toString('base64'));
await writeFile('dist/NovaSight-System-Studio.html', (await readFile('src/index.html','utf8'))
 .replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>')
 .replace('<script defer src="./studio.js"></script>',()=>'<script>document.addEventListener("DOMContentLoaded",()=>{'+js.replaceAll('</script','<\\/script')+'});</script>'));
console.log('Built hosted application and offline standalone HTML.');
