import { DonorData, Politician } from "@/types";

interface ImpactSectionProps {
  donors: DonorData[];
  politician: Politician | null;
}

export default function ImpactSection({ donors, politician }: ImpactSectionProps) {
  // Find the dominant industry
  const industryMap = new Map<string, number>();
  
  donors.forEach(donor => {
    if (donor.industry) {
      const currentAmount = industryMap.get(donor.industry) || 0;
      industryMap.set(donor.industry, currentAmount + donor.amount);
    }
  });
  
  let dominantIndustry = "";
  let highestAmount = 0;
  
  industryMap.forEach((amount, industry) => {
    if (amount > highestAmount) {
      highestAmount = amount;
      dominantIndustry = industry;
    }
  });
  
  // Generate impact text based on dominant industry
  const getImpactText = () => {
    if (!dominantIndustry) return defaultImpactText;
    
    const industryImpacts: Record<string, string> = {
      "Finance/Insurance": "The significant funding from the finance and insurance sector may influence the politician's stance on financial regulations, banking oversight, and tax policies affecting investment income. This could impact consumer protections in financial services and the overall regulatory environment for Wall Street.",
      
      "Health": "With substantial backing from the healthcare industry, the politician may take positions on healthcare policy that align with industry interests. This could affect healthcare costs, insurance coverage requirements, pharmaceutical pricing, and the structure of healthcare delivery systems that directly impact your medical expenses and care options.",
      
      "Energy": "Strong support from the energy sector suggests the politician may favor policies beneficial to these donors, potentially affecting environmental regulations, climate initiatives, and energy production subsidies. This could impact everything from the air quality in your community to energy prices and job opportunities in traditional or renewable energy sectors.",
      
      "Technology": "Backing from tech companies may influence the politician's approach to internet regulation, data privacy laws, antitrust enforcement, and technology sector taxation. This could affect your online privacy, the services available to you, and the competitive landscape of the digital economy.",
      
      "Defense": "Significant funding from defense contractors may lead the politician to support higher defense budgets and military interventions. This could influence national security policy, military spending priorities, and international relations in ways that affect both tax dollars and global stability.",
    };
    
    // Return specific impact text if available, otherwise use a generic one based on the industry name
    return industryImpacts[dominantIndustry] || 
      `The significant funding from the ${dominantIndustry.toLowerCase()} sector may influence the politician's policy positions in ways that directly affect regulations, tax policies, and government priorities related to this industry. This could impact your daily life through changes in consumer protections, available services, and economic opportunities.`;
  };
  
  const defaultImpactText = "Political donations can significantly influence a politician's policy priorities and voting patterns. Large donors often gain increased access to elected officials, potentially shaping legislation in ways that benefit their interests. This can affect everything from healthcare costs and environmental regulations to tax policy and consumer protections that impact your daily life.";
  
  const impactText = getImpactText();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">What This Means For You</h2>
      
      {dominantIndustry && (
        <div className="mb-4 inline-block px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
          Dominant donor industry: <strong>{dominantIndustry}</strong>
        </div>
      )}
      
      <p className="text-foreground/80 leading-relaxed">{impactText}</p>
      
      {politician?.profileUrl && (
        <div className="mt-6">
          <a 
            href={politician.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-primary hover:underline"
          >
            View {politician.name}'s full profile on OpenSecrets
            <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
} 