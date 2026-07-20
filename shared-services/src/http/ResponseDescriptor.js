function json(body, status = 200) {
    return { kind: 'json', status, body };
}

function file(filePath, mediaType, length, status = 200) {
    return { kind: 'file', status, filePath, mediaType, length };
}

function noContent(status = 204) {
    return { kind: 'no-content', status };
}

module.exports = { json, file, noContent };
