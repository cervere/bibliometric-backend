import fs from 'fs';
import Papa from 'papaparse';

const resolveDuplicates = (entries) => {
    // Assuming doximity_md is an array of objects
    let duplicates = new Map();
    let nonDuplicates = [];

    // Find duplicates
    entries.forEach((item, index) => {
        if (item.name) {
            if (duplicates.has(item.name)) {
                duplicates.get(item.name).push(item);
            } else {
                duplicates.set(item.name, [item]);
            }
        }
    });

    // Separate duplicates and non-duplicates
    duplicates.forEach((value, key) => {
        if (value.length > 1) {
            // Apply aggregation function to resolve program name
            let resolvedUrls = value.map(item => item.url).join('|');
            nonDuplicates.push({ name: key, url: resolvedUrls });
        } else {
            nonDuplicates.push(value[0]);
        }
    });

    // Result
    return nonDuplicates;
}

export const splitName = (displayName) => {
    let fullName = displayName.split(',')[0];
    let parts = fullName.split(' ');
    let firstName = parts[0];
    let numNames = parts.length;
    let lastName, middleName, simpleName;

    if (numNames === 1) {
        lastName = '';
        middleName = '';
    } else if (numNames === 2) {
        lastName = parts[1];
        middleName = '';
    } else if (numNames === 3) {
        lastName = parts[2];
        middleName = parts[1];
    } else {
        lastName = parts[parts.length - 1];
        middleName = '';
    }

    simpleName = `${firstName} ${lastName}`;
    return { firstName, middleName, lastName, simpleName, numNames };
}

export const getDoximityNames = async () => {
    const file = fs.readFileSync('./.data/publicurls.csv', 'utf8');

    const results = Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        worker: true,
    });

    const doximityEnts = resolveDuplicates(results.data);
    const doximityNames = doximityEnts.map(({ name, url }) => {
        const altNames = splitName(name);
        return { name, ...altNames, url }
    })

    return doximityNames.reduce((acc, curr) => {
        if (acc[curr.simpleName]) {
            acc[curr.simpleName].push(curr);
        } else {
            acc[curr.simpleName] = [curr];
        }
        return acc;
    }, {});
}
