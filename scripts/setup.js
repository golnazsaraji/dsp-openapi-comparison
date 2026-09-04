const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const generatedServer = path.join(root, 'generated-openapi-generator-custom');

function runNpm(args, cwd) {
    const npmCli = process.env.npm_execpath;
    const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    const commandArgs = npmCli ? [npmCli, ...args] : args;
    const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit' });

    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

runNpm(['ci'], root);
runNpm(['run', 'generate:final'], root);
runNpm(['ci'], generatedServer);
