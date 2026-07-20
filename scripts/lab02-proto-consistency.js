const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const canonical = path.join(root, 'shared-services', 'lab02', 'proto', 'converter.proto');
assert(fs.existsSync(canonical), 'canonical Converter proto is missing');
const proto = fs.readFileSync(canonical, 'utf8');
assert(proto.includes('rpc Convert(stream ConvertRequest) returns (stream ConvertResponse)'));
assert(proto.includes('ConversionMetadata') && proto.includes('ConversionResult') && proto.includes('ConversionFailure'));
const pom = fs.readFileSync(path.join(root, 'shared-services', 'lab02', 'converter-java', 'pom.xml'), 'utf8');
assert(pom.includes('<protoSourceRoot>${project.basedir}/../proto</protoSourceRoot>'));
const client = fs.readFileSync(path.join(root, 'shared-services', 'src', 'images', 'ConverterClient.js'), 'utf8');
assert(client.includes("'lab02', 'proto', 'converter.proto'"));
assert(!fs.existsSync(path.join(root, 'specifications', 'lab02', 'proto', 'converter.proto')),
    'remove the obsolete second project proto source');
console.log('Canonical proto consistency check passed.');
