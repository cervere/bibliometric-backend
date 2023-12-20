import { readFileSync } from 'fs';
import { getIndividualsWithProgramData } from './individuals-with-programs.js';
import { splitName } from '../doximity/loadDoximityNames.js';
import { getDoximityNames } from '../doximity/loadDoximityNames.js';
import { readJSONFiles } from '../../utils/file-utils.js';

function isAffiliationMatch(educationName, affiliationValue) {
    if (educationName && educationName.trim() !== '') {
        const eduNames = educationName.toLowerCase().split('/');
        // Later if we realize there can be more separating characters in program names
        let affMatch = false;
        for (let edu of eduNames) {
            affMatch = affMatch || affiliationValue.includes(edu);
        }
        return affMatch;
    }
    return false;
}

function getAffiliationMatch(row, affiliationValueOrig) {
    const affiliationValue = affiliationValueOrig.toLowerCase();
    const affMatch = isAffiliationMatch(row['education_name'], affiliationValue);
    const affLooseMatch = (row['THA_report_name'] && row['THA_city'] && row['THA_state']) ? affiliationValue.includes(row['THA_report_name'].toLowerCase()) &&
        affiliationValue.includes(row['THA_city'].toLowerCase()) &&
        affiliationValue.includes(row['THA_state'].toLowerCase()) : false;

    return [affMatch, affLooseMatch];
}


function modifyObjectKeys(obj, prefix) {
    const modifiedObj = {};
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = `${prefix}_${key.trim().replace(/ /g, '_')}`;
            modifiedObj[newKey] = obj[key];
        }
    }
    return modifiedObj;
}

export const isFirstAuthorStudent = (authorFirstEduLevel, authorFirstEstimatedYOG, publication_date) => {
    if (authorFirstEduLevel === 'Student*') {
        return true;
    } else if (authorFirstEduLevel === 'resident' && authorFirstEstimatedYOG > 2000) {
        if (authorFirstEstimatedYOG > 0 && new Date(publication_date) < new Date(`${authorFirstEstimatedYOG}-12-31`)) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}

export const combinePublicationsIndividualsAndPrograms = async () => {
    const simplifiedPubs = readJSONFiles('./.data/pubs');
    // const simplifiedPubsJSON = readFileSync('./.data/simplifieddata.json', 'utf8');
    // const simplifiedPubs = JSON.parse(simplifiedPubsJSON);

    const aamcRes = await getIndividualsWithProgramData();
    const indPro = {}

    aamcRes.forEach((item) => {
        if (!indPro[item.fullname]) {
            indPro[item.fullname] = {};
        }
        indPro[item.fullname] = { ...item }
    });

    const pubsIndPro = {}

    const doxNames = await getDoximityNames();

    simplifiedPubs.forEach((pub) => {
        const { id_doi, id_pmid, title, publication_date,
            author_first_display_name, author_first_raw_affiliation_string, author_first_edu_level,
            author_last_display_name, author_last_raw_affiliation_string } = pub

        if (id_doi) {
            let author_first_data = {}
            let author_program_data = {}
            if (author_first_display_name) {
                if (indPro[author_first_display_name]) {
                    const faProgramData = indPro[author_first_display_name];
                    const [affMatch, affLooseMatch] = getAffiliationMatch(faProgramData, author_first_raw_affiliation_string);
                    faProgramData['affiliation_match'] = affMatch;
                    faProgramData['affiliation_loose_match'] = affLooseMatch;
                    const faProgramDataMod = modifyObjectKeys(faProgramData, 'author_first');
                    const first_author_student = isFirstAuthorStudent(faProgramData['edu level'], faProgramData['estimatedYOG'], publication_date)
                    author_program_data = { ...faProgramDataMod, first_author_student }
                }
                if (!author_first_edu_level) {
                    const { simpleName } = splitName(author_first_display_name);
                    if (simpleName in doxNames) {
                        author_first_data['author_first_edu_level'] = 'MD'
                    } else {
                        author_first_data['author_first_edu_level'] = 'Student*'
                    }
                }
            }
            if (author_last_display_name && indPro[author_last_display_name]) {
                const laProgramData = indPro[author_last_display_name];
                const [affMatch, affLooseMatch] = getAffiliationMatch(laProgramData, author_last_raw_affiliation_string);
                laProgramData['affiliation_match'] = affMatch;
                laProgramData['affiliation_loose_match'] = affLooseMatch;
                const laProgramDataMod = modifyObjectKeys(laProgramData, 'author_last');
                author_program_data = { ...author_program_data, ...laProgramDataMod }
            }
            if (Object.keys(author_program_data).length > 0 &&
                'author_last_affiliation_match' in author_program_data) {
                pubsIndPro[id_doi] = {
                    id_doi, id_pmid, title, publication_date,
                    author_first_display_name, author_first_raw_affiliation_string,
                    ...author_first_data,
                    author_last_display_name, author_last_raw_affiliation_string,
                    ...author_program_data
                }
            }
        }
    })
    // const pubsWithFirstAuthors = simplifiedPubs.filter(
    //     ({ id_doi, author_first_display_name }) => (id_doi && author_first_display_name))
    //     .map(({ id_doi, author_first_display_name, author_first_raw_affiliation_string }) => ({ id_doi, author_first_display_name, author_first_raw_affiliation_string }))

    // const pubsWithLastAuthors = simplifiedPubs.filter(
    //     ({ id_doi, author_last_display_name }) => (id_doi && author_last_display_name))
    //     .map(({ id_doi, author_last_display_name, author_last_raw_affiliation_string }) => ({ id_doi, author_last_display_name, author_last_raw_affiliation_string }))

    // const firstPubsIndPro = mergeObjects(pubsWithFirstAuthors, aamcRes, 'author_first_display_name', 'fullname')
    // const lastPubsIndPro = mergeObjects(pubsWithLastAuthors, aamcRes, 'author_last_display_name', 'fullname')

    // const pubsFAWithAffMatch = firstPubsIndPro.map((pub) => {
    //     const [affMatch, affLooseMatch] = getAffiliationMatch(pub, 'author_first_raw_affiliation_string')
    //     return { ...pub, author_first_affiliation_match: affMatch, author_first_affiliation_loose_match: affLooseMatch }
    // })
    // const pubsLAWithAffMatch = lastPubsIndPro.map((pub) => {
    //     const [affMatch, affLooseMatch] = getAffiliationMatch(pub, 'author_last_raw_affiliation_string')
    //     return { ...pub, author_last_affiliation_match: affMatch, author_last_affiliation_loose_match: affLooseMatch }
    // })


    return pubsIndPro;
}
