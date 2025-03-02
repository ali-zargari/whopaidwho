import { NextRequest, NextResponse } from "next/server";
import { DonorData } from "@/types";

// Mock data to use when API fails or for testing
const MOCK_DATA: Record<string, DonorData[]> = {
  "N00000528": [ // Bernie Sanders
    { name: "University of California", amount: 99548, industry: "Education" },
    { name: "Alphabet Inc", amount: 81255, industry: "Technology" },
    { name: "Amazon.com", amount: 62412, industry: "Retail" },
    { name: "Microsoft Corp", amount: 53241, industry: "Technology" },
    { name: "Apple Inc", amount: 45632, industry: "Technology" },
    { name: "Kaiser Permanente", amount: 41235, industry: "Health" },
    { name: "US Government", amount: 38756, industry: "Government" },
    { name: "AT&T Inc", amount: 32145, industry: "Telecommunications" },
    { name: "State of California", amount: 29876, industry: "Government" },
    { name: "Walmart Inc", amount: 26543, industry: "Retail" }
  ],
  "N00033085": [ // Ted Cruz
    { name: "Club for Growth", amount: 113456, industry: "Conservative Policy" },
    { name: "Exxon Mobil", amount: 98765, industry: "Energy" },
    { name: "Goldman Sachs", amount: 87654, industry: "Finance/Insurance" },
    { name: "Koch Industries", amount: 76543, industry: "Energy" },
    { name: "Boeing Co", amount: 65432, industry: "Defense" },
    { name: "AT&T Inc", amount: 54321, industry: "Telecommunications" },
    { name: "Lockheed Martin", amount: 43210, industry: "Defense" },
    { name: "Chevron Corp", amount: 32109, industry: "Energy" },
    { name: "Bank of America", amount: 21098, industry: "Finance/Insurance" },
    { name: "Raytheon Technologies", amount: 10987, industry: "Defense" }
  ],
  "N00033492": [ // Elizabeth Warren
    { name: "EMILY's List", amount: 105432, industry: "Women's Issues" },
    { name: "Harvard University", amount: 94321, industry: "Education" },
    { name: "Alphabet Inc", amount: 83210, industry: "Technology" },
    { name: "Microsoft Corp", amount: 72109, industry: "Technology" },
    { name: "Apple Inc", amount: 61098, industry: "Technology" },
    { name: "Kaiser Permanente", amount: 50987, industry: "Health" },
    { name: "University of California", amount: 49876, industry: "Education" },
    { name: "Amazon.com", amount: 38765, industry: "Retail" },
    { name: "Walt Disney Co", amount: 27654, industry: "Entertainment" },
    { name: "Massachusetts General Hospital", amount: 16543, industry: "Health" }
  ],
  "N00003389": [ // Mitch McConnell
    { name: "Blackstone Group", amount: 119876, industry: "Finance/Insurance" },
    { name: "Kindred Healthcare", amount: 108765, industry: "Health" },
    { name: "UBS AG", amount: 97654, industry: "Finance/Insurance" },
    { name: "JPMorgan Chase & Co", amount: 86543, industry: "Finance/Insurance" },
    { name: "Humana Inc", amount: 75432, industry: "Health" },
    { name: "Altria Group", amount: 64321, industry: "Tobacco" },
    { name: "FedEx Corp", amount: 53210, industry: "Transportation" },
    { name: "General Electric", amount: 42109, industry: "Manufacturing" },
    { name: "Citigroup Inc", amount: 31098, industry: "Finance/Insurance" },
    { name: "Brown-Forman Corp", amount: 20987, industry: "Food & Beverage" }
  ],
  "N00041162": [ // Alexandria Ocasio-Cortez
    { name: "Alphabet Inc", amount: 89765, industry: "Technology" },
    { name: "University of California", amount: 78654, industry: "Education" },
    { name: "City University of New York", amount: 67543, industry: "Education" },
    { name: "Amazon.com", amount: 56432, industry: "Retail" },
    { name: "Apple Inc", amount: 45321, industry: "Technology" },
    { name: "Microsoft Corp", amount: 34210, industry: "Technology" },
    { name: "Kaiser Permanente", amount: 23109, industry: "Health" },
    { name: "New York University", amount: 12098, industry: "Education" },
    { name: "Columbia University", amount: 10987, industry: "Education" },
    { name: "Walt Disney Co", amount: 9876, industry: "Entertainment" }
  ]
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid");
  
  if (!cid) {
    return NextResponse.json({ error: "Missing candidate ID (cid)" }, { status: 400 });
  }
  
  // Get API key from environment variables
  const apiKey = process.env.OPENSECRETS_API_KEY;
  
  // If no API key is provided, return mock data
  if (!apiKey) {
    console.warn("No OpenSecrets API key found. Using mock data.");
    return NextResponse.json({ 
      donors: MOCK_DATA[cid] || [], 
      isMockData: true 
    });
  }
  
  try {
    // Construct the OpenSecrets API URL
    const cycle = new Date().getFullYear(); // Current election cycle
    const url = `https://www.opensecrets.org/api/?method=candContrib&cid=${cid}&cycle=${cycle}&apikey=${apiKey}&output=json`;
    
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    
    if (!response.ok) {
      throw new Error(`OpenSecrets API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the OpenSecrets response
    const contributors = data.response.contributors.contributor;
    
    if (!contributors || !Array.isArray(contributors)) {
      throw new Error("Invalid response format from OpenSecrets API");
    }
    
    // Transform the data to our format
    const donors: DonorData[] = contributors.map((contributor: any) => ({
      name: contributor["@attributes"].org_name,
      amount: parseInt(contributor["@attributes"].total, 10),
      industry: contributor["@attributes"].industry || undefined
    }));
    
    return NextResponse.json({ donors, isMockData: false });
    
  } catch (error) {
    console.error("Error fetching from OpenSecrets API:", error);
    
    // Return mock data as fallback
    return NextResponse.json({ 
      donors: MOCK_DATA[cid] || [], 
      isMockData: true 
    });
  }
} 