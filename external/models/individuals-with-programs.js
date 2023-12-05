import { readFileSync } from 'fs';
import {getAAMCProgramData, getResidencyExplorerProgramData} from '../g-sheets/base.js';

export const getIndividualsWithProgramData = async () => {
    const individualsMetaStr = readFileSync('./.data/individuals.json');
    const individualsMeta = JSON.parse(individualsMetaStr)
    console.log(`Loaded ${individualsMeta?.count} individuals`)
    const programsMetaStr = readFileSync('./.data/programs.json');
    const programsMeta = JSON.parse(programsMetaStr);
    console.log(`Loaded ${programsMeta?.count} programs`);

    // Load original sheet AAMC and Residency data
    const programsAAMCandRE = await combineAAMCandREProgramData();

    const individuals = individualsMeta.data;
    
    const individualsWithProgramData = individuals.map((individual) => {
        const indProgramName = individual['program name']; // might contain | when resolving duplicates
        const programData = Object.values(programsAAMCandRE).find((program) => indProgramName.indexOf(program?.ama_program_name) > -1) 
        
        return {
            ...individual,
            ...programData
        }
    })

    return individualsWithProgramData;
}

export const combineAAMCandREProgramData = async () => {
    const programsAAMC = await getAAMCProgramData();
    const programsResidencyExplorer = await getResidencyExplorerProgramData();
    const programsAAMCandRE = {};

    Object.keys(programsAAMC).map((programId) => {
        const programAAMCInfo = programsAAMC[programId];
        const programREInfo = programsResidencyExplorer[programId] || {};
        programsAAMCandRE[programId] = {
            'program_id': programAAMCInfo["Program ID"],
            'ama_program_name': programAAMCInfo["AMA Program Name"],
            'education_name': programAAMCInfo["Education Name"],
            'THA_report_name': programAAMCInfo["THA Report Name"],
            'THA_city': programAAMCInfo["THA City"],
            'THA_state': programAAMCInfo["THA State"],
            'weekly_work_hours_first_yr': programAAMCInfo["Avg. hrs/wk on duty during first year"],
            'salary_first_yr': programAAMCInfo["First Year Salary"],
            'program_description': programAAMCInfo["Program best described as"],
            'director_degrees': programAAMCInfo["Director Degrees"],
            'program_setting': programREInfo["Program setting"],
            'resident_joint_md_phd': programREInfo["residents_joint_MD_PhD"],
            'num_residents_on_duty': programREInfo["Total # Residents on Duty"],
            'residents_moonlighting_allowed': programREInfo["Program allows residents (beyond PGY1) to moonlight?"],
            'research_rotation': programREInfo["Program curriculum includes a dedicated research rotation"],
            'pct_md_US': programREInfo["Percentage of residents who were US MD graduates"],
            'pct_do_US': programREInfo["Percentage of residents who were US DO graduates"]
        }
    })

    return programsAAMCandRE; 
}