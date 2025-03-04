import { NextRequest, NextResponse } from "next/server";
import { DonorData } from "@/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid");
  const apiKey = process.env.OPENFEC_API_KEY;

  if (!cid || !apiKey) {
    return NextResponse.json({ error: "Missing candidate ID or API key.", donors: [] }, { status: 400 });
  }

  const SMALL_DONATION_LIMIT = 200;
  let smallDonationsTotal = 0;

  try {
    const committeesRes = await fetch(`https://api.open.fec.gov/v1/candidate/${cid}/committees/?api_key=${apiKey}`);
    const committeesData = await committeesRes.json();

    if (!committeesData.results || committeesData.results.length === 0) {
      return NextResponse.json({ error: "No committees found.", donors: [] }, { status: 404 });
    }

    const donorMap = new Map<string, { amount: number, industry?: string }>();

    for (const committee of committeesData.results) {
      const committeeId = committee.committee_id;

      const donationsRes = await fetch(
          `https://api.open.fec.gov/v1/schedules/schedule_a/?committee_id=${committeeId}&sort=-contribution_receipt_amount&per_page=100&api_key=${apiKey}`
      );
      const donationsData = await donationsRes.json();

      if (donationsData.results) {
        for (const contribution of donationsData.results) {
          const amount = contribution.contribution_receipt_amount || 0;

          if (amount <= SMALL_DONATION_LIMIT) {
            smallDonationsTotal += amount;
            continue;
          }

          const name = contribution.contributor_name || "Anonymous";
          const industry =
              contribution.contributor_employer ||
              contribution.contributor_occupation ||
              "Unknown Industry";

          const existingDonor = donorMap.get(name) || { amount: 0 };
          existingDonor.amount += amount;
          if (!existingDonor.industry) {
            existingDonor.industry = industry;
          }
          donorMap.set(name, existingDonor);
        }
      }
    }

    if (smallDonationsTotal > 0) {
      donorMap.set("Small Individual Donations", {
        amount: smallDonationsTotal,
        industry: "Grassroots"
      });
    }

    const donors: DonorData[] = Array.from(donorMap.entries())
        .map(([name, data]) => ({
          name,
          amount: data.amount,
          industry: data.industry,
        }))
        .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({ donors });
  } catch (error) {
    return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error.", donors: [] },
        { status: 500 }
    );
  }
}
