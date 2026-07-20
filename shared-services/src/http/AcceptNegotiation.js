const REPRESENTATIONS = ['application/json', 'image/png', 'image/jpeg', 'image/gif'];
const ALIASES = new Map([['image/jpg', 'image/jpeg']]);

function parseQuality(parameters) {
    const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith('q='));
    if (!qualityParameter) return 1;
    const quality = Number(qualityParameter.split('=', 2)[1]);
    return Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
}

function parseAccept(header) {
    const value = header === undefined || header === null || String(header).trim() === ''
        ? 'application/json' : String(header);
    return value.split(',').map((entry, order) => {
        const [rawMediaRange, ...parameters] = entry.split(';');
        const mediaRange = rawMediaRange.trim().toLowerCase();
        return {
            mediaRange: ALIASES.get(mediaRange) || mediaRange,
            quality: parseQuality(parameters),
            order,
        };
    }).filter((entry) => entry.mediaRange.includes('/'));
}

function matchSpecificity(mediaRange, representation) {
    if (mediaRange === representation) return 2;
    const [rangeType, rangeSubtype] = mediaRange.split('/');
    const [representationType] = representation.split('/');
    if (rangeType === representationType && rangeSubtype === '*') return 1;
    if (mediaRange === '*/*') return 0;
    return -1;
}

function negotiateAccept(header) {
    const ranges = parseAccept(header);
    const candidates = REPRESENTATIONS.map((mediaType, preference) => {
        const matches = ranges.map((range) => ({
            ...range,
            specificity: matchSpecificity(range.mediaRange, mediaType),
        })).filter((match) => match.specificity >= 0);
        if (matches.length === 0) return null;
        const mostSpecific = Math.max(...matches.map((match) => match.specificity));
        const controllingMatches = matches.filter((match) => match.specificity === mostSpecific)
            .sort((left, right) => right.quality - left.quality || left.order - right.order);
        return { mediaType, preference, ...controllingMatches[0] };
    }).filter((candidate) => candidate && candidate.quality > 0);

    if (candidates.length === 0) return null;
    candidates.sort((left, right) => right.quality - left.quality
        || right.specificity - left.specificity
        || left.preference - right.preference
        || left.order - right.order);
    return candidates[0].mediaType;
}

module.exports = { negotiateAccept, parseAccept, REPRESENTATIONS };
