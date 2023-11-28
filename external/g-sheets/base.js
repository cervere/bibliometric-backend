import axios from "axios";

// Function to get counts by grouping values of a key 'k'
export function getCountsByGrouping(arr, key) {
    return arr.reduce((counts, obj) => {
      const keyValue = obj[key];
  
      // If the key is not in counts, initialize it with count 1
      if (!counts[keyValue]) {
        counts[keyValue] = 1;
      } else {
        // Increment the count if the key is already present
        counts[keyValue]++;
      }
  
      return counts;
    }, {});
  }

const standardizeRank = (rank_field) => {
    if (!rank_field) return '';
    const rank = rank_field.split().join(' ').trim().toLowerCase()
    const ranks = []
    if (rank == '')
        return rank

    // Order sensitive
    const standardizedChairRanks = [
        {key: 'Interim VC', keywords: ["interim vice chair", "interim vicechair", "interim vc"]},
        {key: 'VC', keywords: ["vice chair", "vicechair", "vc"]},
        {key: 'Interim Chair', keywords: ["interim chair"]},
        {key: 'Chair', keywords: ["chair"]}
    ] 
    for (const rankInOrder of standardizedChairRanks) {
        if(rankInOrder.keywords.filter((keyword) => rank.includes(keyword)).length > 0) {
            ranks.push(rankInOrder.key);
            break;
        }
    }
    const standardizedDirectorRanks = [
        {key: 'APD', keywords: ["associate program director", "assistant program director"]},
        {key: 'Interim PD', keywords: ["interim program director", "interim pd "]},
        {key: 'PD', keywords: ["program director"]},
    ] 
    for (const rankInOrder of standardizedDirectorRanks) {
        if(rankInOrder.keywords.filter((keyword) => rank.includes(keyword)).length > 0) {
            ranks.push(rankInOrder.key);
            break;
        }
    }

    return ranks.join(',')
}

const getDataObj = (data) => {
    const individual_foi = ['program name', 'first name', 'middle initial', 'last name', 'edu level', 'rank', 'title', 'PGY-#']

    const columns = data.shift(); // remove the first element and store it in a variable
  
  const result = data.reduce((acc, curr) => {
    const obj = {};
    columns.forEach((column, index) => {
      if(column) {
      obj[column.trim().replace(/-/g, '_')] = curr[index];
      }
    });
    const simpleObj = {}
    individual_foi.forEach((field) => {
        simpleObj[field] = obj[field]
    })
    simpleObj['rank_std'] = standardizeRank(simpleObj.rank)
    acc.push(simpleObj);
    // const programName = obj.program_name?.trim();
    // if(programName) {
    //   acc[programName] = obj    
    // }
    return acc;
  }, []);
  //Testing
//   return getCountsByGrouping(result, 'rank_std');
    return result;
}
  

export const getManualIndividualData = async () => {
    const SHEET_ID = '1GE0LVl4nXehh8EVK1CSiIAvebAB1ovbIrOIC5vo3k9c';
    const DATA_SHEET_NAME = 'all_fac_fel_res'
    const API_KEY = 'AIzaSyCKYp7lfxQqmLUD065YuziyDSuSm2n2zz0';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${DATA_SHEET_NAME}`;

    const res = await axios.get(url, {
      params: {
        key: API_KEY
      }
    })
    .catch((error) => {
      console.error(error.response.data);
    });
  if(res) {
    return getDataObj(res.data.values);
  } else {
    return {message: 'Forbidden'};
  }
}