import { NextRequest, NextResponse } from "next/server";
import { DonorData } from "@/types";

// Validate FEC candidate ID format (basic validation)
function isValidFecCandidateId(cid: string): boolean {
  // FEC candidate IDs typically start with H, S, or P followed by digits and letters
  // This is a basic validation - adjust as needed based on actual FEC ID patterns
  return /^[HSP][0-9A-Z]+$/.test(cid);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid");
  const cycleParam = searchParams.get("cycle"); // e.g. "2024" or "2022"

  console.log("Donors API request params:", { cid, cycleParam });

  if (!cid) {
    return NextResponse.json({ 
      error: "Missing candidate ID (cid)",
      donors: [] 
    }, { status: 400 });
  }

  // Validate CID format
  if (!isValidFecCandidateId(cid)) {
    console.error(`Invalid FEC candidate ID format: "${cid}"`);
    return NextResponse.json({ 
      error: `Invalid FEC candidate ID format: "${cid}"`,
      donors: [] 
    }, { status: 400 });
  }

  const apiKey = process.env.OPENFEC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "OpenFEC API key is missing. Please add it to your environment variables.",
      donors: []
    }, { status: 500 });
  }

  // Fall back to a default cycle if none provided in the query
  let cycle = cycleParam ? Number(cycleParam) : (new Date().getFullYear() % 2 === 0 ? new Date().getFullYear() : new Date().getFullYear() - 1);

  try {
    // Use the candidate_id parameter to fetch donations for the specific candidate
    const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${apiKey}` +
        `&sort=-contribution_receipt_amount&per_page=100&contributor_type=individual` +
        `&candidate_id=${cid}&two_year_transaction_period=${cycle}`;

    console.log(`Fetching donors for candidate: ${cid} (cycle: ${cycle})`);
    
    // Log URL with API key partially redacted for security
    const redactedUrl = url.replace(apiKey, apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4));
    console.log("Donors URL (redacted):", redactedUrl);

    const response = await fetch(url, { next: { revalidate: 3600 } });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenFEC API error (${response.status}):`, errorText);
      throw new Error(`OpenFEC API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      console.error("Invalid response format:", JSON.stringify(data).substring(0, 200) + "...");
      throw new Error("Invalid response format from OpenFEC API");
    }

    console.log(`Raw API response contains ${data.results.length} contributions for candidate ${cid}`);

    // Process the donations to group by donor and industry
    const donorMap = new Map<string, { amount: number, industry?: string }>();

    data.results.forEach((contribution: any) => {
      const name = contribution.contributor_name || "Anonymous";
      const amount = contribution.contribution_receipt_amount || 0;
      
      // Get existing donor data or create new entry
      const existingDonor = donorMap.get(name) || { amount: 0 };
      
      // Update amount
      existingDonor.amount += amount;
      
      // Update industry if available
      if (!existingDonor.industry && (contribution.contributor_employer || contribution.contributor_occupation)) {
        existingDonor.industry = contribution.contributor_employer || contribution.contributor_occupation;
      }
      
      // Store updated donor data
      donorMap.set(name, existingDonor);
    });

    // Convert map to array and sort by amount
    const donors: DonorData[] = Array.from(donorMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        industry: data.industry
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20); // Limit to top 20 donors

    console.log(`Processed ${donors.length} unique donors for candidate ${cid}`);
    
    // Log the first few donors to help with debugging
    if (donors.length > 0) {
      console.log("Top donors:", donors.slice(0, 3).map(d => ({ 
        name: d.name, 
        amount: d.amount,
        industry: d.industry 
      })));
    }
    
    // If no donors found, return an empty array with a message
    if (donors.length === 0) {
      console.log(`No donors found for candidate ${cid} in cycle ${cycle}`);
      return NextResponse.json({
        donors: [],
        message: `No donor data found for candidate ID ${cid} in the ${cycle} election cycle.`
      });
    }

    return NextResponse.json({ donors });

  } catch (error) {
    console.error("Error fetching from OpenFEC API:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      donors: [] // Return empty array to prevent UI errors
    }, { status: 502 });
  }
}
