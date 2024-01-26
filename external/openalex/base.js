import axios from "axios";
import { writeFile } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import 'dotenv/config';
import { collapseIds, collapseAuthorFields, collapseHostVenue, collapseConcepts } from "./utils.js";
import { getProgramData } from "../g-sheets/base.js";
import { getIndividuals } from "../g-sheets/new-base.js";
import { backupAndWriteFile } from "../../utils/file-utils.js";

const BASE_URL = 'https://api.openalex.org/works';
const PUBS_PER_PAGE = 200;

const base_filter = {
  from_publication_date: process.env.SEMANTIC_PUBS_START_DATE,
  country: 'US',
  publication_type: 'journal',
  is_paratext: 'false',
  search_term: 'neurosurgery'
}
const BASE_FILTER_STR = `
            from_publication_date:${base_filter.from_publication_date},
            authorships.institutions.country_code:${base_filter.country},
            primary_location.source.type:${base_filter.publication_type},
            is_paratext:${base_filter.is_paratext},
            raw_affiliation_string.search:${base_filter.search_term}
    `.replace(/ {2,}/g, "\t").replace(/[\r\n\t]/gm, "");

const BASE_PARAMS = {
  filter: BASE_FILTER_STR,
  sort: 'publication_year:desc',
  'per-page': PUBS_PER_PAGE,
}



const simplifyPubStructure = (publicationReceived) => {
  const { id, title, publication_date,
    ids,
    authorships,
    primary_location,
    concepts,
  } = publicationReceived;
  const simplifiedPub = {
    id, title, publication_date,
    ...collapseIds(ids),
    ...collapseHostVenue(primary_location),
    ...collapseAuthorFields(authorships),
    ...collapseConcepts(concepts)
  }

  return simplifiedPub;
}

const getPubs = async (cursor) => {
  const res = await axios.get(BASE_URL, {
    params: {
      ...BASE_PARAMS,
      cursor: cursor || '*'
    }
  })
  let cleanRes = {}
  if (res.status === 200) {
    if (res.data) {
      const { results, meta } = res.data;
      cleanRes = { results }
      if (meta) {
        return { ...cleanRes, totalPubsToFetch: meta.count, nextCursor: meta.next_cursor }
      } else {
        throw new Error('Metadata missing from response')
      }
    } else {
      throw new Error('Data missing in response!!');
    }
  }
}

export const fetchAllPublications = async () => {
  const rawPublicationDownloadStatus = await fetchRawPublicationDownloadStatus();
  let message = '';

  if (rawPublicationDownloadStatus.success && !isTimestampWeekAgo(rawPublicationDownloadStatus.timestamp)) {
    message = 'Status is success, but timestamp is within a week.';
  } else {
    if (rawPublicationDownloadStatus.success) {
      message = 'Status is success, and timestamp is older than a week.';
    } else {
      message = 'Status is a failure.';
    }
  }

  const simplifiedPubsJSON = readFileSync('./.data/simplifieddata.json', 'utf8');
  const simplifiedPubs = JSON.parse(simplifiedPubsJSON);

  if (simplifiedPubs) {
    return { data: simplifiedPubs.slice(100), message }
  } else {
    return { data: [], message, failed: true }
  }
}

class SimplifiedPubs {
  constructor() {
    this.publications = [];
    this.fileCount = 0;
    this.MAX_BUFFER_SIZE = 256 * 1048576
  }

  add(pubs) {
    this.publications.push(...pubs);
    this.writeSimplified();
  }

  clear() {
    this.publications.length = 0;
  }

  write() {
    saveSimplifiedPublications(this.publications, `./.data/pubs/simplifieddata.${this.fileCount}.json`);
    this.fileCount += 1
    this.clear();
  }

  writeSimplified() {
    if (this.publications.length >= 50) {
      const elementSize = Buffer.byteLength(JSON.stringify(this.publications), 'utf8');
      if (this.publications.length >= 1000 || elementSize > this.MAX_BUFFER_SIZE) {
        this.write();
      }
    }
  }
}

const logMemory = () => {
  const memUsage = process.memoryUsage();
  const memKeys = Object.keys(memUsage).map((key) => {
    return `${key}: ${(memUsage[key] / 1024 / 1024).toFixed(2)}MB`
  })
  console.log(memKeys.join(','));
}

export const fetchAllPublicationsFromSemantic = async () => {
  const simplifiedPubs = new SimplifiedPubs() // Write in batches of 5000
  const publications = [];
  let totalPubsToFetch = -1;
  let pubCount = 0;
  let nextCursor;
  try {
    const pubResults = await getPubs();
    // publications.push(...pubResults.results);
    simplifiedPubs.add(pubResults.results);
    pubCount = pubResults.results.length;
    totalPubsToFetch = pubResults.totalPubsToFetch
    nextCursor = pubResults.nextCursor
  } catch (err) {
    console.error('Error fetching the first set of publications!', err)
  }

  console.log(`Received a total of ${totalPubsToFetch}`);
  while (nextCursor && pubCount < totalPubsToFetch) {
    const pubResults = await getPubs(nextCursor);
    // publications.push(...pubResults.results);
    simplifiedPubs.add(pubResults.results);
    pubCount += pubResults.results.length;
    totalPubsToFetch = pubResults.totalPubsToFetch
    nextCursor = pubResults.nextCursor;
  }
  simplifiedPubs.write();
  console.log(`Finished downloading ${pubCount} publications`);
  return publications;
}

export const isTimestampWeekAgo = (timestamp) => {
  const givenDate = new Date(timestamp);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return givenDate < oneWeekAgo
}

export const fetchRawPublicationDownloadStatus = () => {
  // Read the status JSON from the file
  try {
    const statusJSON = readFileSync('./.data/status.json', 'utf8');
    const status = JSON.parse(statusJSON);

    return status;
  } catch (err) {
    console.log(err)
    return { success: false }
  }
}


export const saveSimplifiedPublications = async (pubs, filePath) => {
  // console.log('Preparing simplified data structure for storage');
  const simplifiedPublications = pubs.map((pub) => simplifyPubStructure(pub));
  const jsonData = JSON.stringify(simplifiedPublications, null, 4);
  try {
    backupAndWriteFile(filePath, jsonData);
    // writeFileSync('./.data/simplifieddata.json', jsonData)
    console.log(`Writing simplified JSON ${filePath} was successful.`);
  } catch (err) {
    console.error('Error writing simplified data:', err);
  };
  return { message: 'Publications simplification is in progress. Please check back later !!' }
}

export const updateBasePublications = async (downloadSettingsHash) => {
  const saveRawData = false // Ideally, we could save the raw data as received from Sem. Sch. 
  // But the free server Glitch we're using to host, has a memory limit of 512MB. So saving rawdata has been difficult.
  // So this flag can be handled appropriately when there are no memory constraints.
  await getProgramData();
  await getIndividuals();
  fetchAllPublicationsFromSemantic().then(async (pubs) => {
    // saveSimplifiedPublications(pubs, './.data/simplifieddata.json')
    // .then(async () => {
    writeStatus(true, false, downloadSettingsHash, Number(process.env.SEMANTIC_PUBS_START_DATE.split('-')[0]), 'Writing simplified publication data JSON to file was successful.')
    // if (saveRawData) {
    //   console.log('Saving raw publication data, just in case...');
    //   const jsonData = JSON.stringify(pubs, null, 4);
    //   writeFile('./.data/rawdata.json', jsonData)
    //     .then(() => {
    //       console.log('Writing JSON to file was successful.');
    //       writeStatus(true, 'Writing raw data JSON to file was successful.')
    //     })
    //     .catch((err) => {
    //       console.error('Error writing file:', err);
    //       writeStatus(false, 'Error writing raw data JSON to file.')
    //     });
    // }
  }).catch((err) => {
    console.error("Error simplifying data...", err);
    writeStatus(false, false, downloadSettingsHash, new Date().getFullYear(), 'Error writing simplified publication data JSON to file.')
  });
  return { message: 'Publications download is in progress. Please check back later !!' }
}

export const writeStatus = (success, downloadInProgress, downloadSettingsHash, publicationsSince, message) => {
  const statusJSON = JSON.stringify({
    success,
    downloadInProgress,
    downloadSettingsHash,
    publicationsSince,
    timestamp: new Date().toISOString(),
    message
  }, null, 2);
  // Write the JSON string to a file
  try {
    backupAndWriteFile('./.data/status.json', statusJSON)
  } catch (err) {
    console.error("Error writing status file", err);
  }
}