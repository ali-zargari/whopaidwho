import { NextRequest, NextResponse } from "next/server";
import { Politician } from "@/types";

// Cache to reduce repeated API calls
let cachedPoliticians: Politician[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    if (cachedPoliticians && now - lastFetchTime < CACHE_DURATION) {
      return NextResponse.json({ politicians: cachedPoliticians });
    }

    const fecApiKey = process.env.OPENFEC_API_KEY || "your_api_key_here";

    // Determine the current election cycle (use current even year or previous even year)
    const currentYear = new Date().getFullYear();
    const cycle = currentYear % 2 === 0 ? currentYear : currentYear - 1;

    // Helper to fetch all pages from the API
    async function fetchAllPages(url: string, transform: (item: any) => Politician): Promise<Politician[]> {
      let results: Politician[] = [];
      let page = 1;
      let hasMorePages = true;
      while (hasMorePages) {
        const response = await fetch(`${url}&page=${page}&per_page=100`);
        if (!response.ok) {
          console.warn(`Failed to fetch page ${page}:`, await response.text());
          break;
        }
        const data = await response.json();
        results = results.concat(data.results.map(transform));
        hasMorePages = data.pagination && data.pagination.pages > page;
        page++;
      }
      return results;
    }

    // Fetch senators (office "S")
    const senateUrl = `https://api.open.fec.gov/v1/candidates/?api_key=${fecApiKey}&election_year=${cycle}&office=S&candidate_status=C`;
    const senators = await fetchAllPages(senateUrl, candidate => transformCandidate(candidate, "Senator"));

    // Fetch House candidates (office "H")
    const houseUrl = `https://api.open.fec.gov/v1/candidates/?api_key=${fecApiKey}&election_year=${cycle}&office=H&candidate_status=C`;
    const houseCandidates = await fetchAllPages(houseUrl, candidate => transformCandidate(candidate, "Representative"));

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

  return {
    id: candidate.candidate_id.toUpperCase(),
    name: candidate.name,
    cid: candidate.candidate_id.toUpperCase(),
    party: partyMap[candidate.party] || candidate.party || "Other",
    state: candidate.state || "Unknown",
    position,
    isIncumbent: true, // Simplify by assuming all are active for UI purposes
    isCandidate: true, // Keep this true for compatibility with existing code
    district,
    profileUrl: `https://www.fec.gov/data/candidate/${candidate.candidate_id.toUpperCase()}/`
  };
}

