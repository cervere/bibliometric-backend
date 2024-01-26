export const identifyDuplicates = (arr, field) => {
    const count = arr.reduce((acc, obj) => {
        const key = obj[field];
        const entry = acc[key] || { count: 0, entries: [] }
        entry.count = entry.count + 1;
        entry.entries.push(obj);
        acc[key] = entry
        return acc;
    }, {});
    return { unique: Object.values(count).filter((k) => k.count === 1), duplicate: Object.values(count).filter((k) => k.count > 1) };
}