import { readFileSync } from 'fs';
import { getCountsByGrouping } from './base.js';

const individualsJSON = readFileSync('./.data/individuals.json', 'utf8');
const individuals_base = JSON.parse(individualsJSON);


const getFullname = (individual) => {
    const fullName = individual['first name']?.trim('.,') +
                    (individual['middle initial'] == '' ? ' ' : ` ${individual['middle initial']?.trim()} `) +
                    individual['last name']?.trim('.,')
    return fullName
} 

const individuals = individuals_base.map((ind) => {return {...ind, full_name: getFullname(ind)}})

const indByName = {};
const duplicates = {};

individuals.forEach((ind) => {
    const name = ind.full_name
    if (name in indByName) {
        if(name in duplicates) {
            const dupInd = duplicates[name]
            dupInd.push(ind);
        } else {
            duplicates[name] = [indByName[name], ind];
        }
    } else {
        indByName[name] = ind
    }
})

const uniqueIndividuals = individuals.filter((ind) => !(ind.full_name in duplicates));

const resolvedIndividuals = Object.values(duplicates).map((dupind) => dupind.reduce((newInd, ind) => {
    for (const key in ind) {
        if(key in newInd && newInd[key].trim() !== '') {
            if(ind[key] !== newInd[key]) {
                newInd[key] = `${newInd[key]} | ${ind[key]}`
            }            
        } else {
            newInd[key] = ind[key]
        }
    }
    return newInd
}, {}));

console.log([...uniqueIndividuals, ...resolvedIndividuals]);


