import { NextRequest, NextResponse } from "next/server";
import { DonorData } from "@/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid");
  
  if (!cid) {
    return NextResponse.json({ error: "Missing candidate ID (cid)" }, { status: 400 });
  }
  
  // Get API key from environment variables
  const apiKey = process.env.OPENFEC_API_KEY;
  
  // If no API key is provided, return error
  if (!apiKey) {
    return NextResponse.json({ 
      error: "OpenFEC API key is missing. Please add it to your environment variables." 
    }, { status: 500 });
  }
  
  try {
    // Construct the OpenFEC API URL for committee contributions
    // First get the candidate's committees
    const candidateUrl = `https://api.open.fec.gov/v1/candidate/${cid}/committees/?api_key=${apiKey}&sort=-last_file_date`;
    
    const candidateResponse = await fetch(candidateUrl, { next: { revalidate: 3600 } });
    
    if (!candidateResponse.ok) {
      throw new Error(`OpenFEC API returned ${candidateResponse.status}: ${candidateResponse.statusText}`);
    }
    
    const candidateData = await candidateResponse.json();
    
    if (!candidateData.results || candidateData.results.length === 0) {
      return NextResponse.json({ 
        error: "No committee data found for this candidate" 
      }, { status: 404 });
    }
    
    // Use the principal campaign committee
    const committeeId = candidateData.results[0].committee_id;
    
    // Get top donors/contributions for this committee
    const donorsUrl = `https://api.open.fec.gov/v1/schedules/schedule_a/by_contributor/by_committee/?api_key=${apiKey}&committee_id=${committeeId}&sort=-contribution_receipt_amount&per_page=10`;
    
    const donorsResponse = await fetch(donorsUrl, { next: { revalidate: 3600 } });
    
    if (!donorsResponse.ok) {
      throw new Error(`OpenFEC API returned ${donorsResponse.status}: ${donorsResponse.statusText}`);
    }
    
    const donorsData = await donorsResponse.json();
    
    if (!donorsData.results || !Array.isArray(donorsData.results)) {
      throw new Error("Invalid response format from OpenFEC API");
    }
    
    // Transform the data to our format
    const donors: DonorData[] = donorsData.results.map((contributor: any) => ({
      name: contributor.contributor_name,
      amount: contributor.contribution_receipt_amount,
      industry: contributor.contributor_employer || undefined
    }));
    
    return NextResponse.json({ donors });
    
  } catch (error) {
    console.error("Error fetching from OpenFEC API:", error);
    
    // Return error
    return NextResponse.json({ 
      error: `Failed to fetch donor data: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 502 });
  }
} 