import axios from "axios";
import 'dotenv/config';

const SHEET_ID = process.env.GSHEET_INDIVIDUALDETAILS_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;
const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/`;


//CONSTANTS : Sheet column names
const PROGRAM_KEY = 'Program';
const FULLNAME_KEY = 'Name';
const DEGREES_KEY = 'Degree(s)';
// Residents
const RESIDENT_SHEET_PROGRAM_KEY = 'Program';
const RESIDENT_SHEET_FULLNAME_KEY = 'Name';
const RESIDENT_SHEET_DEGREE_KEY = 'Degree(s)';
const RESIDENT_SHEET_PGY_KEY = 'Post_Grad Year (PGY#, 1_7)'; // '-'s replaced with '_' later while processing the sheet

// Fellows 
const FELLOW_SHEET_PROGRAM_KEY = 'Program';
const FELLOW_SHEET_FULLNAME_KEY = 'Name';
const FELLOW_SHEET_DEGREE_KEY = 'Degree(s)';

// Faculty 
const FACULTY_SHEET_PROGRAM_KEY = 'Program';
const FACULTY_SHEET_FULLNAME_KEY = 'Name';
const FACULTY_SHEET_DEGREE_KEY = 'Degree(s)';
const FACULTY_SHEET_TITLE_KEY = 'Title'; // Check later if Detailed Title is desired
const FACULTY_SHEET_RANK_KEY = 'Rank'; // Check later is Detailed Rank is desired

const standardizeRank = (rank_field) => {
    if (!rank_field || rank_field === 'N/A') return '';
    const rank = rank_field.split().join(' ').trim().toLowerCase()
    const ranks = []
    if (rank == '')
        return rank

    // Order sensitive
    const standardizedChairRanks = [
        { key: 'Interim VC', keywords: ["interim vice chair", "interim vicechair", "interim vc"] },
        { key: 'VC', keywords: ["vice chair", "vicechair", "vc"] },
        { key: 'Interim Chair', keywords: ["interim chair"] },
        { key: 'Chair', keywords: ["chair"] }
    ]
    for (const rankInOrder of standardizedChairRanks) {
        if (rankInOrder.keywords.filter((keyword) => rank.includes(keyword)).length > 0) {
            ranks.push(rankInOrder.key);
            break;
        }
    }
    const standardizedDirectorRanks = [
        { key: 'APD', keywords: ["associate program director", "assistant program director"] },
        { key: 'Interim PD', keywords: ["interim program director", "interim pd "] },
        { key: 'PD', keywords: ["program director"] },
    ]
    for (const rankInOrder of standardizedDirectorRanks) {
        if (rankInOrder.keywords.filter((keyword) => rank.includes(keyword)).length > 0) {
            ranks.push(rankInOrder.key);
            break;
        }
    }

    return ranks.join(',')
}

const estimatedYOG = (pgy) => {
    if (pgy > 0 && pgy < 10) {
        const currentYear = new Date().getFullYear();
        const yearsToSubtract = pgy + 1;
        const estimatedYOG = currentYear - yearsToSubtract;
        return estimatedYOG;
    } else {
        return -1;
    }
}

const baseObject = (obj, eduLevel) => {
    const simpleObj = {}
    // 'program name', 'full name', 'edu level'
    simpleObj['programName'] = obj[PROGRAM_KEY]
    if (simpleObj['programName'] && simpleObj['programName'] !== '' && !simpleObj['programName'].endsWith(' Program')) {
        simpleObj['programName'] += ' Program';
    }
    simpleObj['fullName'] = obj[FULLNAME_KEY]
    simpleObj['eduLevel'] = eduLevel
    simpleObj['degrees'] = obj[DEGREES_KEY]
    return simpleObj
}

const processFacultySheet = (data) => {
    const columns = data.shift(); // remove the first element and store it in a variable

    const result = data.reduce((acc, curr) => {
        const obj = {};
        columns.forEach((column, index) => {
            if (column) {
                obj[column.trim().replace(/-/g, '_')] = curr[index];
            }
        });
        const simpleObj = baseObject(obj, 'faculty'); // program name, full name, edu level
        // 'rank', 'title'
        simpleObj['rank'] = obj[FACULTY_SHEET_RANK_KEY].indexOf('N/A') > -1 ? '' : obj[FACULTY_SHEET_RANK_KEY]
        simpleObj['rank_std'] = standardizeRank(simpleObj.rank);
        simpleObj['title'] = obj[FACULTY_SHEET_TITLE_KEY]

        acc.push(simpleObj);
        return acc;
    }, []);

    return result;
}

export const getManualFacultyData = async () => {
    const DATA_SHEET_NAME = 'Faculty'
    const url = `${BASE_URL}${DATA_SHEET_NAME}`;

    const res = await axios.get(url, {
        params: {
            key: API_KEY
        }
    })
        .catch((error) => {
            console.error(error.response.data);
        });
    if (res) {
        return processFacultySheet(res.data.values);
    } else {
        return { message: 'Forbidden' };
    }
}

const processResidentsSheet = (data) => {
    const columns = data.shift(); // remove the first element and store it in a variable
    const result = data.reduce((acc, curr) => {
        const obj = {};
        columns.forEach((column, index) => {
            if (column) {
                obj[column.trim().replace(/-/g, '_')] = curr[index];
            }
        });
        const simpleObj = baseObject(obj, 'resident'); //program name, full name, edu level
        //  'PGY_#'
        const pgyStr = obj['Post_Grad Year (PGY#, 1_7)']
        let singleDigitNumber = pgyStr.match(/\d$/);
        // PGY is generally a single digit number. Sheet has varying values - PGY 3 or PGY-3 
        const pgyNum = singleDigitNumber ? parseInt(singleDigitNumber[0]) : null;

        const pgy = (isNaN(pgyNum) || pgyNum > 9) ? -1 : pgyNum;
        simpleObj['PGY_#'] = pgy;
        simpleObj["estimatedYOG"] = estimatedYOG(pgy)
        // No rank, title
        acc.push(simpleObj);
        return acc;
    }, []);

    return result;
}

export const getManualResidentsData = async () => {
    const DATA_SHEET_NAME = 'Residents'
    const url = `${BASE_URL}${DATA_SHEET_NAME}`;

    const res = await axios.get(url, {
        params: {
            key: API_KEY
        }
    }).catch((error) => {
        console.error(error.response.data);
    });
    if (res) {
        return processResidentsSheet(res.data.values);
    } else {
        return { message: 'Forbidden' };
    }
}

const processFellowsSheet = (data) => {
    const columns = data.shift(); // remove the first element and store it in a variable

    const result = data.reduce((acc, curr) => {
        const obj = {};
        columns.forEach((column, index) => {
            if (column) {
                obj[column.trim().replace(/-/g, '_')] = curr[index];
            }
        });
        const simpleObj = baseObject(obj, 'fellow'); // program name, full name, edu level
        // No pgy, rank, title
        acc.push(simpleObj);
        return acc;
    }, []);

    return result;
}

export const getManualFellowsData = async () => {
    const DATA_SHEET_NAME = 'Fellows'
    const url = `${BASE_URL}${DATA_SHEET_NAME}`;

    const res = await axios.get(url, {
        params: {
            key: API_KEY
        }
    })
        .catch((error) => {
            console.error(error.response.data);
        });
    if (res) {
        return processFellowsSheet(res.data.values);
    } else {
        return { message: 'Forbidden' };
    }
}

export const getManualIndividualData = async () => {
    // get individually fellow, residents and faculty data

    const residents = await getManualResidentsData();
    const fellows = await getManualFellowsData();
    const faculty = await getManualFacultyData();
    /**
     * Important fields needed from all of them:
     *
     * 'program name'
     * 'full name'
     * 'edu level'
     * 'rank'
     * 'title'
     * 'PGY_#' 
     */
    return [...residents, ...fellows, ...faculty]

}

export const resolveDuplicates = (duplicateEntries) => {
    const duplicatesResolved = duplicateEntries.map((entry) => {
        const { count, entries } = entry
        const staticKeys = ['fullName'];
        const dynamicKeys = ['programName', 'eduLevel', 'rank', 'rank_std', 'title', 'PGY_#'];
        const consolidatedEntry = consolidateEntries(entries, staticKeys, dynamicKeys);
        return consolidatedEntry
    });
    return duplicatesResolved
}

function consolidateEntries(arr, staticKeys, dynamicKeys) {
    const eduLevelMapping = {
        'student': 1,
        'resident': 2,
        'fellow': 3,
        'faculty': 4,
    };

    return arr.reduce((acc, entry) => {
        staticKeys.forEach(key => {
            acc[key] = entry[key];
        });
        dynamicKeys.forEach(key => {

            if (entry[key]) {
                if (key === 'PGY_#') {
                    acc[key] = Math.max(acc[key] || -1, entry[key])
                } else if (key === 'eduLevel') {
                    acc[key] = maxString(acc[key], entry[key], eduLevelMapping);
                } else {
                    acc[key] = acc[key] && (acc[key] !== entry[key]) ? `${acc[key]}|${entry[key]}` : entry[key];
                }
            }
        });
        return acc;
    }, {});
}

const maxString = (str1, str2, mapping) => {
    const num1 = mapping[str1] || -Infinity;
    const num2 = mapping[str2] || -Infinity;
    const maxNum = Math.max(num1, num2);
    return maxNum === -Infinity ? `${str1}|${str2}` : (maxNum === num1) ? str1 : str2;
}

export const getIndividualData = async () => {
    const preparedData = await getManualIndividualData();
    const individuals = identifyDuplicates(preparedData, 'fullname')
    const uniqueIndividuals = individuals.uniqueInds.map(({ entries }) => entries[0])
    const resolvedIndividuals = [...uniqueIndividuals]
    const duplicatesResolved = resolveDuplicates(individuals.duplicateInds)
    resolvedIndividuals.push(...duplicatesResolved);
    return resolvedIndividuals;
}