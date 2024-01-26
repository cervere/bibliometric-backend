// server.js
// where your node app starts

// init project
import express from "express";
import cors from "cors";
const app = express();
import axios from "axios";
import NodeCache from 'node-cache';
import { writeFile } from 'fs/promises';

import {
  updateBasePublications, fetchRawPublicationDownloadStatus, saveSimplifiedPublications,
  fetchAllPublications, isTimestampWeekAgo
} from './external/openalex/base.js'
import { getRawPublicationData } from './models/publication.js';
import { getManualProgramData, identifyDuplicates, getAAMCProgramData, getResidencyExplorerProgramData } from './external/g-sheets/base.js';
import { combineAAMCandREProgramData, getIndividualsWithProgramData } from './external/models/individuals-with-programs.js';
import { combinePublicationsIndividualsAndPrograms } from './external/models/combine-pub-ind-pro.js';
import { getDoximityNames } from './external/doximity/loadDoximityNames.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { getManualIndividualData, resolveDuplicates, getIndividualData } from "./external/g-sheets/new-base.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// http://expressjs.com/en/starter/static-files.html
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: '1mb' })) // for parsing application/json
app.use(express.urlencoded({ extended: true }));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/list", function (request, response) {
  response.send({ id: 1 });
});

app.post("/save", function (request, response) {
  console.log(request.body)
  const { title, conversation } = request.body;
  console.log(title, conversation);
  response.status(200).send({ 'message': 'Received ' + title });
});

app.get("/duplicateInds", async (req, res) => {
  // This service is for debugging
  const { debug } = req.query
  const result = await getManualIndividualData();
  const individuals = identifyDuplicates(result, 'fullName')
  const resolvedIndividuals = resolveDuplicates(individuals.duplicateInds);
  if (debug === '1') {
    const dupes = individuals.duplicateInds.map((entry) => entry.entries);
    dupes.forEach((dupe, i) => dupe.push(resolvedIndividuals[i]))
    res.status(200).send(dupes);
  } else {
    res.status(200).send(resolvedIndividuals);
  }
})

app.get('/doxind', async (req, res) => {
  const doxNames = await getDoximityNames();
  const resultWithMeta = {
    count: Object.keys(doxNames).length,
    updateAt: new Date(),
    data: doxNames
  }
  res.status(200).send(resultWithMeta);
})

app.get("/pind", async (req, res) => {
  const result = await getIndividualData();
  const resultWithMeta = {
    count: result.length,
    updateAt: new Date(),
    data: result.slice()
  }
  console.log('Saving raw data, just in case...');
  const jsonData = JSON.stringify(resultWithMeta, null, 4);
  writeFile('./.data/individuals.json', jsonData)
    .then(() => {
      console.log("Downloaded individuals data from google sheets is saved in a file")
    })
  res.status(200).send(resultWithMeta);
})

app.get("/aamc", async function (request, response) {
  const aamcRes = await getAAMCProgramData();
  if (aamcRes.failed) {
    response.status(404).send({ message: 'Failed' });
  } else {
    response.status(200).send(aamcRes);
  }
})

app.get("/resi", async function (request, response) {
  const aamcRes = await getResidencyExplorerProgramData();
  if (aamcRes.failed) {
    response.status(404).send({ message: 'Failed' });
  } else {
    response.status(200).send(aamcRes);
  }
})

app.get("/aamcresi", async function (request, response) {
  const aamcRes = await combineAAMCandREProgramData();
  if (aamcRes.failed) {
    response.status(404).send({ message: 'Failed' });
  } else {
    response.status(200).send(aamcRes);
  }
})

app.get("/indpro", async function (request, response) {
  const aamcRes = await getIndividualsWithProgramData();
  const resultWithMeta = {
    count: aamcRes.length,
    updateAt: new Date(),
    data: aamcRes.slice()
  }
  if (aamcRes.failed) {
    response.status(404).send({ message: 'Failed' });
  } else {
    response.status(200).send(resultWithMeta);
  }
})


app.get("/programs", async function (request, response) {
  const programsRes = await getManualProgramData();
  if (programsRes.failed) {
    response.status(404).send({ message: 'Failed' });
  } else {
    const programsWithMeta = {
      count: Object.keys(programsRes).length,
      updatedAt: new Date(),
      data: programsRes
    }
    console.log('Saving raw data, just in case...');
    const jsonData = JSON.stringify(programsWithMeta, null, 4);
    writeFile('./.data/programs.json', jsonData)
      .then(() => {
        console.log("Downloaded programs data from google sheets is saved in a file")
      })
    response.status(200).send(programsWithMeta);
  }
})

const minifyDoximityData = (userData) => {
  return userData.map((user) => {
    const name = user.name;
    const credentials = user.credentials;
    const sex = user.meta?.profile_gender;
    const description = user.meta?.description;
    const summary = user.profileSummary;
    const memberships = user.memberShips?.length;
    const education = user.education?.length;
    const certifications = user.certifications?.length;
    const awards = user.awards?.length;
    const clinicalTrialsParticipated = user.clinicalTrials?.length;
    const clinicalTrialsCompleted = user.clinicalTrials?.filter((trial) =>
      trial?.status === 'Completed')?.length
    const nonJournalMedia = user.nonJournalMedia?.length;
    const pressMentions = user.pressMentions?.length;
    const affiliations = user.affiliations?.length;

    return {
      name,
      credentials,
      sex,
      description,
      summary,
      memberships,
      education,
      certifications,
      awards,
      clinicalTrialsParticipated,
      clinicalTrialsCompleted,
      nonJournalMedia,
      pressMentions,
      affiliations
    }
  })
}

app.get("/individuals", async (request, response) => {
  const DOXIMITY_USER_DATA_URL = "https://raw.githubusercontent.com/cervere/bibliometric-tool-static/main/data/doximity-user-data.json";
  const res = await axios.get(DOXIMITY_USER_DATA_URL);
  if (res) {
    response.status(200).send(minifyDoximityData(res.data));
  } else {
    response.status(404).send({ message: 'Forbidden' });
  }
})

const cache = new NodeCache();
const BASE_URL = 'https://api.semanticscholar.org/graph/v1';
const PAPER_URL_ROUTE = BASE_URL + '/paper/';
const SEMANTIC_API_KEY = 'e7gL5nOqna5RQH7713cdC3DDtgivLtmd4KsSPApR';
const SEMANTIC_API_HEADERS = {
  //   'Content-Type': 'application/json',
  //   [SEMANTIC_API_KEY_HEADER]: SEMANTIC_API_KEY
  'x-api-key': SEMANTIC_API_KEY
};

const failedDOIs = new Set();

const getPaperCitationCountsByDOI = async (dois) => {
  const doisFormatted = dois.map((doi) => 'DOI:' + doi);
  const url = PAPER_URL_ROUTE + 'batch?fields=citationCount,title,authors'

  const data = { ids: doisFormatted };
  try {
    const response = await axios.post(url, data, { headers: SEMANTIC_API_HEADERS });
    if (response.status === 200) {
      response.data?.forEach((entry, i) => {
        if (entry) {
          cache.set(dois[i], entry, 7 * 24 * 60 * 60); // Cache for 7 days
          failedDOIs.delete(dois[i]);
        }
      })
      return response.data
    }
  } catch (error) {
    dois.forEach((doi) => failedDOIs.add(doi))
    if (error.response) {
      if (error.response.status === 429) {
        // Handle 429 error (Too Many Requests)
        console.log('Too Many Requests:', error.response.data);
      } else {
        // Handle other response errors
        console.log('Error:', error.response.data, doisFormatted);
      }
    } else {
      // Handle network or request-related errors
      console.log('Request Error:', error);
    }
  }

}

app.get('/pubs', (req, res) => {
  res.send(updateBasePublications());
})

app.get('/pubs-sample', async (req, res) => {
  const result = await fetchAllPublications();
  const resultWithMeta = {
    count: result.data.length,
    updateAt: new Date(),
    data: result.data
  }
  if (result.failed) {
    res.status(404).send({ message: 'Failed' });
  } else {
    res.status(200).send(resultWithMeta);
  }
})

app.get('/pub-ind-pro', async (req, res) => {
  console.log('Checking the status of raw publication data download from OpenAlex...');
  const rawPublicationDownloadStatus = await fetchRawPublicationDownloadStatus();
  const messages = [];
  let initiateFreshPublicationDownload = false;
  if (rawPublicationDownloadStatus.success && !isTimestampWeekAgo(rawPublicationDownloadStatus.timestamp)) {
    console.log("Publications data recently updated.");
  } else {
    if (rawPublicationDownloadStatus.success) {
      messages.push("Publication data is more than a week old.")
    } else {
      messages.push("Latest publication data download status from OpenAlex was not found!!");
    }
    initiateFreshPublicationDownload = true;
    messages.push("Starting a fresh download now! Please try again in an hour for the most recent data!")
  }

  /**
   * 1. Check the recency of the downloaded publication data
   * 2. If within a week, no message to add
   * 3. Else: 
   *  3.1. start the async pipeline that downloads raw data and stores simplifieddata
   *  3.2. append a disclaimer about this included in the response
   * 4. In both cases, simply load available simplifieddata.json
   * 5. If either of status file or simplifieddata.json is not available, 
   *    then it is a problem. Send a 404, bring it to the attention of devs
   */
  try {
    const result = await combinePublicationsIndividualsAndPrograms();
    const resultWithMeta = {
      someData: true,
      count: Object.keys(result).length,
      updateAt: rawPublicationDownloadStatus.success ? new Date(rawPublicationDownloadStatus.timestamp) : new Date(),
      data: result,
      message: messages
    }
    if (initiateFreshPublicationDownload) {
      updateBasePublications();
    }
    res.status(200).send(resultWithMeta);
  } catch (err) {
    console.log(err);
    updateBasePublications();
    messages.push("Unexpected error while loading publications. Please inform support and try again later!")
    res.status(404).send({ message: messages })
  }

})

app.get('/simplify-pubs', (req, res) => {
  const rawDataDownloadStatus = fetchRawPublicationDownloadStatus();
  if (rawDataDownloadStatus.success && !isTimestampWeekAgo(rawDataDownloadStatus.timestamp)) {
    const publications = getRawPublicationData();
    res.send(saveSimplifiedPublications(publications, './.data/simplifieddata.json'));
  } else {
    res.send({ message: 'Raw publications data need to be updated! Please request /pubs with necessary authentication!' });
  }
})

app.post('/semantic-pubs', async (req, res) => {
  console.log(`In Queue ${failedDOIs.size} DOIs`)
  const { fields } = req.query;
  const { ids } = req.body;
  let doisToFetch = []
  let citationCounts = {}
  let authorIdDetails = {}
  for (const id of ids) {
    const cachedResult = cache.get(id);
    if (cachedResult !== undefined) {
      citationCounts[id] = cachedResult.citationCount
      authorIdDetails[id] = cachedResult.authors
    } else {
      doisToFetch.push(id)
    }
  }

  if (doisToFetch.length > 0) {
    console.log(`Fetching missing dois...`)
    const res = await getPaperCitationCountsByDOI(doisToFetch);
    res?.forEach((entry, i) => {
      citationCounts[doisToFetch[i]] = entry?.citationCount
      authorIdDetails[doisToFetch[i]] = entry?.authors
    })
  }
  let response = { citationCounts, authorIdDetails };

  res.json(response);
});


// listen for requests :)
const listener = app.listen(process.env.PORT || 3000, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
