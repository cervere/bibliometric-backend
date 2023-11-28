# Plan to migrate PyAlex to Node OpenAlex

 - [x] prepare the base openalex api with required filters
    ```js
    https://api.openalex.org/works?filter=from_publication_date:2013-01-01,
                authorships.institutions.country_code:US,
                primary_location.source.type:journal,
                is_paratext:false,
                raw_affiliation_string.search:neurosurgery
                &sort=publication_year:desc
                &per-page=200
    ```
 - [x] Call the above api as many times as a valid cursor (`response.meta.next_cursor`) is returned in the response, using it for the next call.
    - First call: `base_url&cursor=*`
 - [x] Decide if you want to save the above results into a file
 - [x] Extract new fields for convenience
    - [x] Identifier fields
        ```js
        response.ids : {'openalex': 'https://openalex.org/W4306730981',
                    'doi': 'https://doi.org/10.4103/1673-5374.355749',
                    'pmid': 'https://pubmed.ncbi.nlm.nih.gov/36254972'
                    }
        ```
    - [x] Primary Location (`depricated` : `host_venue`)
        ```js
        response.primary_location : { ...
        'source': {
            'id': 'https://openalex.org/S80372421',
            'display_name': 'Neural Regeneration Research',
            'issn_l': '1673-5374',
            'is_oa': True,
            'type': 'journal'
            ...
        },
        }
        ```
    - [x] Authorships 
        ```js
        [
            {
            'author_position': 'first',
            'author': {'id': 'https://openalex.org/A4316358452',
            'display_name': 'Jonathan J Halford',
            'orcid': None},
            'institutions': [{'id': 'https://openalex.org/I153297377',
                'display_name': 'Medical University of South Carolina',
                'ror': 'https://ror.org/012jban78',
                'country_code': 'US',
                'type': 'education'}],
            'raw_affiliation_string': 'Department of Neurology .. '
            }
        ]
        ```
         - Collect the following fields, per author position
        ```js
        author_positions = ["first", "last"]
        for field in author_info_foi = ["id", "display_name", "orcid", "raw_affiliation_string"]:
            author_${position}_${field}
        for field in author_inst_info_foi = ["id", "display_name", "type"]
            author_${position}_institution_${field}
        ```
        - If multiple values for a given author, concat with `|`
