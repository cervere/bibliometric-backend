# Plan to migrate PyAlex to Node OpenAlex

 - [ ] prepare the base openalex api with required filters
    ```js
    https://api.openalex.org/works?filter=from_publication_date:2013-01-01,
                authorships.institutions.country_code:US,
                primary_location.source.type:journal,
                is_paratext:false,
                raw_affiliation_string.search:neurosurgery
                &sort=publication_year:desc
                &per-page=200
    ```
 - [ ] Call the above api as many times as a valid cursor is returned in the response, using it for the next call.
    - First call: `base_url&cursor=*`
 - [ ] Decide if you want to save the above results into a file
 - [ ] Extract new fields for convenience
    - [ ] Identifier fields
        ```js
        response.ids : {'openalex': 'https://openalex.org/W4306730981',
                    'doi': 'https://doi.org/10.4103/1673-5374.355749',
                    'pmid': 'https://pubmed.ncbi.nlm.nih.gov/36254972'
                    }
        ```