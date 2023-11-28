import { readFileSync } from 'fs';

export const getRawPublicationData = () => {
    const rawPublicationsStr = readFileSync('./.data/rawdata.json', 'utf8');
    try {
        return JSON.parse(rawPublicationsStr);
    } catch(err) {
        console.error('Error parsing saved raw data. Please verify')
    }
}