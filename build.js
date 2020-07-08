const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const source = fs.readFileSync('./index.ts', 'utf-8');
const output = ts.transpile(source, {
    module: 'ES6'
});
fs.writeFileSync(path.resolve(__dirname, './index.es.js'), output, 'utf8');
