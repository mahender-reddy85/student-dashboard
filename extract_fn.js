const { execSync } = require('child_process');

try {
    const log = execSync('git log -p script.js', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const lines = log.split('\n');
    let insideFunc = false;
    let braceCount = 0;
    let output = [];

    for (const line of lines) {
        if (line.match(/^[\-\+]function handleKeyboardShortcuts/)) {
            insideFunc = true;
            braceCount = 0;
            output = [];
        }

        if (insideFunc) {
            output.push(line);

            // Very naive brace counter
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '{') braceCount++;
                if (line[i] === '}') braceCount--;
            }

            if (braceCount === 0 && output.length > 1) {
                console.log(output.join('\n'));
                break;
            }
        }
    }
} catch (e) {
    console.error(e);
}
