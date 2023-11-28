// server.js
// where your node app starts

// init project
import express from "express";
import cors from "cors";
const app = express();
import axios from "axios";
import NodeCache from 'node-cache';
import { writeFile } from 'fs/promises';

import {updateBasePublications, fetchRawPublicationDownloadStatus, saveSimplifiedPublications,
  fetchAllPublications} from './external/openalex/base.js'
import {getRawPublicationData} from './models/publication.js';
import {getManualIndividualData} from './external/g-sheets/base.js';
// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: '1mb' })) // for parsing application/json
app.use(express.urlencoded({ extended: true }));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/list", function(request, response) {
  response.send({id: 1});
});

app.post("/save", function(request, response) {
  console.log(request.body)
  const {title, conversation} = request.body;
  console.log(title, conversation);
  response.status(200).send({'message' : 'Received ' + title});
});

const getDataObj = (data) => {
  const columns = data.shift(); // remove the first element and store it in a variable

const result = data.reduce((acc, curr) => {
  const obj = {};
  columns.forEach((column, index) => {
    if(column) {
    obj[column.trim().replace(/-/g, '_')] = curr[index];
    }
  });
  const programId = obj.program_id?.split(':')[1]?.trim();
  if(programId) {
    acc[programId] = obj    
  }
  return acc;
}, {});
  return result;
}

app.get("/pind", async (req, res) => {
  const result = await getManualIndividualData();
  console.log('Saving raw data, just in case...');
  const jsonData = JSON.stringify(result, null, 4);
  writeFile('./.data/individuals.json', jsonData)
  .then(() => {
    console.log("Downloaded individuals data from google sheets is saved in a file")
  })
  res.status(200).send(result);
})

app.get("/programs", async function(request, response) {
    const SHEET_ID = '1poacmUT_2TM00nZ8agOIZFP_dILEd_LLoZbqjOkWFqE';
    const DATA_SHEET_NAME = 'program-full'
    const API_KEY = 'AIzaSyCKYp7lfxQqmLUD065YuziyDSuSm2n2zz0';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${DATA_SHEET_NAME}`;

    const res = await axios.get(url, {
      params: {
        key: API_KEY
      }
    })
    .catch(error => {
      console.error(error);
    });
  if(res) {
    response.status(200).send(getDataObj(res.data.values));
  } else {
    response.status(404).send({message: 'Forbidden'});
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
  if(res) {
    response.status(200).send(minifyDoximityData(res.data));
  } else {
    response.status(404).send({message: 'Forbidden'});
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
    const doisFormatted = dois.map((doi) => 'DOI:'+doi);
    const url = PAPER_URL_ROUTE + 'batch?fields=citationCount,title,authors'

    const data = { ids: doisFormatted };
    try{
        const response = await axios.post(url, data, {headers: SEMANTIC_API_HEADERS});
        if(response.status === 200){
            response.data?.forEach((entry, i) => {
                if(entry) {
                  cache.set(dois[i], entry, 7*24*60*60); // Cache for 7 days
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

app.get('/pubs',  (req, res) => {
  res.send(updateBasePublications());
})

app.get('/pubs-sample',  async (req, res) => {
  const result = await fetchAllPublications();
  res.send(result);
})

app.get('/simplify-pubs',  (req, res) => {
  const rawDataRecent = fetchRawPublicationDownloadStatus();
  if(rawDataRecent) {
    const publications = getRawPublicationData();
    res.send(saveSimplifiedPublications(publications));
  } else {
    res.send({message: 'Raw publications data need to be updated! Please request /pubs with necessary authentication!'});
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
  
  if(doisToFetch.length > 0) {
    console.log(`Fetching missing dois...`)
    const res = await getPaperCitationCountsByDOI(doisToFetch);
    res?.forEach((entry, i) => {
        citationCounts[doisToFetch[i]] = entry?.citationCount
        authorIdDetails[doisToFetch[i]] = entry?.authors
    })
  }
  let response = {citationCounts, authorIdDetails};

  res.json(response);
});


// listen for requests :)
const listener = app.listen(process.env.PORT || 3000, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
