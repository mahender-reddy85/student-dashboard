const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');

let lines = content.split('\n');
let state = 'code';
let braceStack = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let c = 0; c < line.length; c++) {
        let char = line[c];
        let nextChar = line[c + 1];

        if (state === 'code') {
            if (char === '/' && nextChar === '/') { break; } // line comment
            if (char === '/' && nextChar === '*') { state = 'multiline_comment'; c++; continue; }
            if (char === "'") { state = 'single_quote'; continue; }
            if (char === '"') { state = 'double_quote'; continue; }
            if (char === '`') { state = 'template_literal'; continue; }
            if (char === '{') { braceStack.push(i + 1); continue; }
            if (char === '}') { braceStack.pop(); continue; }
        } else if (state === 'multiline_comment') {
            if (char === '*' && nextChar === '/') { state = 'code'; c++; continue; }
        } else if (state === 'single_quote') {
            if (char === '\\') { c++; continue; }
            if (char === "'") { state = 'code'; continue; }
        } else if (state === 'double_quote') {
            if (char === '\\') { c++; continue; }
            if (char === '"') { state = 'code'; continue; }
        } else if (state === 'template_literal') {
            if (char === '\\') { c++; continue; }
            // Ignore variables in template literals for simple check
            if (char === '`') { state = 'code'; continue; }
        }
    }
}
console.log('Unclosed braces pushed at lines:', braceStack);
