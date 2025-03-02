import { DonorData } from "@/types";

interface DonorListProps {
  donors: DonorData[];
}

export default function DonorList({ donors }: DonorListProps) {
  // Sort donors by amount (descending)
  const sortedDonors = [...donors].sort((a, b) => b.amount - a.amount);

  // Determine donor type
  const getDonorType = (donorName: string): { type: string; color: string } => {
    const corporateKeywords = ["Inc", "Corp", "LLC", "Co", "Company", "Group"];
    const pacKeywords = ["PAC", "Committee", "Action", "Fund", "America", "Citizens"];
    const unionKeywords = ["Union", "Workers", "Labor", "Brotherhood", "Association"];
    const universityKeywords = ["University", "College", "School"];
    const governmentKeywords = ["Government", "State of", "Department", "Federal"];
    
    if (corporateKeywords.some(keyword => donorName.includes(keyword))) {
      return { type: "Corporate", color: "bg-blue-500" };
    } else if (pacKeywords.some(keyword => donorName.includes(keyword))) {
      return { type: "PAC", color: "bg-red-500" };
    } else if (unionKeywords.some(keyword => donorName.includes(keyword))) {
      return { type: "Union", color: "bg-orange-500" };
    } else if (universityKeywords.some(keyword => donorName.includes(keyword))) {
      return { type: "University", color: "bg-purple-500" };
    } else if (governmentKeywords.some(keyword => donorName.includes(keyword))) {
      return { type: "Government", color: "bg-green-500" };
    } else {
      return { type: "Individual/Other", color: "bg-gray-500" };
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-2 space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
          <span className="text-xs">Corporate</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
          <span className="text-xs">PAC</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-orange-500 mr-1"></div>
          <span className="text-xs">Union</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-purple-500 mr-1"></div>
          <span className="text-xs">University</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
          <span className="text-xs">Government</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-gray-500 mr-1"></div>
          <span className="text-xs">Individual/Other</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-4">Rank</th>
              <th className="text-left py-2 px-4">Donor</th>
              <th className="text-left py-2 px-4">Type</th>
              <th className="text-left py-2 px-4">Industry</th>
              <th className="text-right py-2 px-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedDonors.map((donor, index) => {
              const { type, color } = getDonorType(donor.name);
              return (
                <tr key={index} className="border-b border-border hover:bg-black/20">
                  <td className="py-2 px-4">{index + 1}</td>
                  <td className="py-2 px-4 font-medium">{donor.name}</td>
                  <td className="py-2 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${color} bg-opacity-20 text-white`}>
                      {type}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-secondary">{donor.industry || "Unknown"}</td>
                  <td className="py-2 px-4 text-right">${donor.amount.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 