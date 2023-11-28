export const collapseIds = (idsObj) => {
    const idsOfInterest = ['openalex', 'doi', 'pmid']
    let idFields = {}
    idsOfInterest.forEach((idType) => {
      idFields[`id_${idType}`] = idsObj[idType]
    })
    return idFields
  } 
  
export const collapseHostVenue = (locationObj) => {
    const fieldsOfInterest = ['id', 'display_name', 'issn_l']
    let hostVenueFields = {}
    fieldsOfInterest.forEach((field) => {
        hostVenueFields[`host_venue_${field}`] = locationObj[field]
    })
    return hostVenueFields
} 

export const collapseAuthorFields = (authorshipsObj) => {
    const authorFields = {}
    const author_positions = ["first", "last"]
    const author_info_foi = ["id", "display_name", "orcid", "raw_affiliation_string"]
    const author_inst_info_foi = ["id", "display_name", "type"]
    author_positions.forEach((authorPos) => {
        const authorsInPos = authorshipsObj.filter((authorObj) => authorObj.author_position === authorPos);

        author_info_foi.forEach((field) => {
            if(authorsInPos.length === 0) {
                authorFields[`author_${authorPos}_${field}`] = undefined;
                return;
            }
            let value;
            if(field in authorsInPos[0].author) {
                if(authorsInPos.length === 1) {
                    value = authorsInPos[0].author[field]
                } else {
                    value = authorsInPos.map((authorInPos) => authorInPos.author[field]).join('|')
                }
            } else {
                if(authorsInPos.length === 1) {
                    value = authorsInPos[0][field]
                } else {
                    value = authorsInPos.map((authorInPos) => authorInPos[field]).join('|')
                }
            }
            authorFields[`author_${authorPos}_${field}`] = value;
        })
        author_inst_info_foi.forEach((field) => {
            if(authorsInPos.length === 0) {
                authorFields[`author_${authorPos}_institution_${field}`] = undefined;
                return;
            }
            let value;
            if(authorsInPos.length === 1) {
                value = authorsInPos[0].institutions.map(inst => inst[field]).join(';')
            } else {
                value = authorsInPos.map((authorInPos) => authorInPos.institutions.map(inst => inst[field]).join(';')).join('|')
            }
            authorFields[`author_${authorPos}_institution_${field}`] = value;
        })
    })

   return authorFields; 
}

export const collapseConcepts = (conceptsObj) => {
    const fields = ['display_name', 'level', 'score']
    let conceptFields = {}
    fields.forEach((field) => {
        conceptFields[`concept_${field}`] = conceptsObj[field]
    })
    return conceptFields
  } 