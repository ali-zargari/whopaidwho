import { NextRequest, NextResponse } from "next/server";
import { Politician } from "@/types";

// Cache to reduce repeated API calls
let cachedPoliticians: Politician[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const showCandidates = searchParams.get("candidates") === "true";
  
  console.log(`Politicians API request - showCandidates: ${showCandidates}`);

  try {
    const now = Date.now();
    if (cachedPoliticians && now - lastFetchTime < CACHE_DURATION) {
      console.log("Returning cached politicians data");
      return NextResponse.json({ politicians: cachedPoliticians });
    }

    const fecApiKey = process.env.OPENFEC_API_KEY || "your_api_key_here";
    if (fecApiKey === "your_api_key_here") {
      console.warn("Using placeholder API key - this will not work with the real API");
    }

    // Determine the current election cycle (use current even year or previous even year)
    const currentYear = new Date().getFullYear();
    const cycle = currentYear % 2 === 0 ? currentYear : currentYear - 1;
    console.log(`Using election cycle: ${cycle}`);

    // Helper to fetch all pages from the API
    async function fetchAllPages(url: string, transform: (item: any) => Politician): Promise<Politician[]> {
      let results: Politician[] = [];
      let page = 1;
      let hasMorePages = true;
      
      console.log(`Starting to fetch pages from: ${url.split('?')[0]}`);
      
      while (hasMorePages) {
        try {
          console.log(`Fetching page ${page}...`);
          const pageUrl = `${url}&page=${page}&per_page=100`;
          
          const response = await fetch(pageUrl);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch page ${page} (${response.status}):`, errorText);
            break;
          }
          
          const data = await response.json();
          
          if (!data.results || !Array.isArray(data.results)) {
            console.error(`Invalid response format for page ${page}:`, JSON.stringify(data).substring(0, 200) + "...");
            break;
          }
          
          // Transform the data and filter out any items with missing or invalid candidate_id
          const validResults = data.results
            .filter((item: any) => item.candidate_id && typeof item.candidate_id === 'string')
            .map(transform);
          
          console.log(`Page ${page}: Found ${data.results.length} raw results, ${validResults.length} valid politicians`);
          
          results = results.concat(validResults);
          
          // Check if there are more pages
          hasMorePages = data.pagination && data.pagination.pages > page;
          page++;
          
          // Safety limit to prevent infinite loops
          if (page > 20) {
            console.warn("Reached maximum page limit (20). Stopping pagination.");
            break;
          }
        } catch (error) {
          console.error(`Error fetching page ${page}:`, error);
          break;
        }
      }
      
      console.log(`Completed fetching. Total politicians: ${results.length}`);
      return results;
    }

    // Fetch senators (office "S")
    const senateUrl = `https://api.open.fec.gov/v1/candidates/?api_key=${fecApiKey}&election_year=${cycle}&office=S&candidate_status=C`;
    console.log("Fetching senators...");
    const senators = await fetchAllPages(senateUrl, candidate => transformCandidate(candidate, "Senator"));
    console.log(`Fetched ${senators.length} senators`);

    // Fetch House candidates (office "H")
    const houseUrl = `https://api.open.fec.gov/v1/candidates/?api_key=${fecApiKey}&election_year=${cycle}&office=H&candidate_status=C`;
    console.log("Fetching representatives...");
    const houseCandidates = await fetchAllPages(houseUrl, candidate => transformCandidate(candidate, "Representative"));
    console.log(`Fetched ${houseCandidates.length} representatives`);

    // Deduplicate senators by candidate id (in case of duplicates)
    const senatorMap = new Map<string, Politician>();
    for (const senator of senators) {
      senatorMap.set(senator.cid, senator);
    }
    const uniqueSenators = Array.from(senatorMap.values());

    // Deduplicate representatives by candidate id (in case of duplicates)
    const representativeMap = new Map<string, Politician>();
    for (const rep of houseCandidates) {
      representativeMap.set(rep.cid, rep);
    }
    const uniqueRepresentatives = Array.from(representativeMap.values());

    const allMembers = uniqueSenators.concat(uniqueRepresentatives);

    // Update cache
    cachedPoliticians = allMembers;
    lastFetchTime = now;

    // Build basic stats for logging/inspection
    const senatorCountsByState: Record<string, number> = {};
    uniqueSenators.forEach(s => {
      senatorCountsByState[s.state] = (senatorCountsByState[s.state] || 0) + 1;
    });

    // Log some sample politicians to verify CIDs
    console.log("Sample politicians with CIDs:");
    const samplePoliticians = allMembers.slice(0, 5);
    samplePoliticians.forEach(p => {
      console.log(`- ${p.name} (${p.party}, ${p.state}): CID=${p.cid}`);
    });

    return NextResponse.json({
      politicians: allMembers,
      stats: {
        total: allMembers.length,
        senators: uniqueSenators.length,
        representatives: uniqueRepresentatives.length,
        senatorCountsByState
      }
    });

  } catch (error) {
    console.error("Error fetching politicians:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      politicians: []
    }, { status: 500 });
  }
}

// Transform candidate API data into our Politician type.
// For representatives, we try to derive the district using candidate.district or office_full.
function transformCandidate(candidate: any, position: string): Politician {
  // Validate candidate_id exists and is in the expected format
  if (!candidate.candidate_id) {
    console.warn(`Missing candidate_id for ${candidate.name || 'unknown candidate'}`);
  } else if (!/^[HSP][0-9A-Z]+$/.test(candidate.candidate_id.toUpperCase())) {
    console.warn(`Unusual candidate_id format: ${candidate.candidate_id} for ${candidate.name || 'unknown candidate'}`);
  }

  // Map FEC party codes to more readable values
  const partyMap: Record<string, string> = {
    "DEM": "Democrat",
    "REP": "Republican",
    "IND": "Independent",
    "LIB": "Libertarian",
    "GRE": "Green",
    // Add other parties as needed
  };

  // Parse district information if available
  let district: string | undefined = undefined;
  if (position === "Representative" && candidate.district) {
    const districtNum = parseInt(candidate.district, 10);
    if (!isNaN(districtNum)) {
      district = districtNum.toString();
    }
  }

  // Ensure candidate_id is properly formatted
  const candidateId = candidate.candidate_id ? candidate.candidate_id.toUpperCase() : '';

  return {
    id: candidateId,
    name: candidate.name || 'Unknown Candidate',
    cid: candidateId, // This is the critical field used for donor lookups
    party: partyMap[candidate.party] || candidate.party || "Other",
    state: candidate.state || "Unknown",
    position,
    isIncumbent: true, // Simplify by assuming all are active for UI purposes
    isCandidate: true, // Keep this true for compatibility with existing code
    district,
    profileUrl: candidateId ? `https://www.fec.gov/data/candidate/${candidateId}/` : '#'
  };
}

