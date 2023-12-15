import axios from "axios";
import { writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { collapseIds, collapseAuthorFields, collapseHostVenue, collapseConcepts } from "./utils.js";



const BASE_URL = 'https://api.openalex.org/works';
const PUBS_PER_PAGE = 200;

const base_filter = {
  from_publication_date: '2023-01-01',
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

export const fetchAllPublicationsFromSemantic = async () => {
  const publications = [];
  let totalPubsToFetch = -1;
  let pubCount = 0;
  let nextCursor;
  try {
    const pubResults = await getPubs();
    publications.push(...pubResults.results);
    pubCount = pubResults.results.length;
    totalPubsToFetch = pubResults.totalPubsToFetch
    nextCursor = pubResults.nextCursor
  } catch (err) {
    console.error('Error fetching the first set of publications!', err)
  }

  console.log(`Received a total of ${totalPubsToFetch}`);
  while (nextCursor && pubCount < totalPubsToFetch) {
    const pubResults = await getPubs(nextCursor);
    publications.push(...pubResults.results);
    pubCount += pubResults.results.length;
    totalPubsToFetch = pubResults.totalPubsToFetch
    nextCursor = pubResults.nextCursor;
  }
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
  const statusJSON = readFileSync('./.data/status.json', 'utf8');
  const status = JSON.parse(statusJSON);

  return status;
}


export const saveSimplifiedPublications = async (pubs) => {
  console.log('Preparing simplified data structure for storage');
  const simplifiedPublications = pubs.map((pub) => simplifyPubStructure(pub));
  const jsonData = JSON.stringify(simplifiedPublications, null, 4);
  writeFile('./.data/simplifieddata.json', jsonData)
    .then(() => {
      console.log('Writing simplified JSON to file was successful.');
    })
    .catch((err) => {
      console.error('Error writing simplified data:', err);
    });
  return { message: 'Publications simplification is in progress. Please check back later !!' }
}

export const updateBasePublications = () => {
  fetchAllPublicationsFromSemantic().then((pubs) => {
    saveSimplifiedPublications(pubs)
      .catch((err) => {
        console.error("Error simplifying data...", err)
      });
    console.log('Saving raw data, just in case...');
    const jsonData = JSON.stringify(pubs, null, 4);
    writeFile('./.data/rawdata.json', jsonData)
      .then(() => {
        console.log('Writing JSON to file was successful.');
        const status = {
          success: true,
          timestamp: new Date().toISOString(),
          message: 'Writing raw data JSON to file was successful.'
        };

        // Convert the status object to a JSON string
        const statusJSON = JSON.stringify(status, null, 2);
        // Write the JSON string to a file
        writeFile('./.data/status.json', statusJSON)
          .catch((err) => {
            console.error("Error writing status file", err);
          })
      })
      .catch((err) => {
        console.error('Error writing file:', err);
      });
  });
  return { message: 'Publications download is in progress. Please check back later !!' }
} 