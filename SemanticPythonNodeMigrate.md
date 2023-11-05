# Plan to migrate PyAlex to Node OpenAlex

 - [ ] call the base openalx api with required filters
    ```js
    https://api.openalex.org/works?filter=from_publication_date:2013-01-01,
                authorships.institutions.country_code:US,
                primary_location.source.type:journal,
                is_paratext:false,
                raw_affiliation_string.search:neurosurgery
                &sort=publication_year:desc
                &per-page=200
    ```