import { useState } from "react";
import { Politician } from "@/types";
import { POLITICIANS } from "@/data/politicians";

interface PoliticianSelectorProps {
  onSelect: (politician: Politician) => void;
}

export default function PoliticianSelector({ onSelect }: PoliticianSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredPoliticians = searchTerm 
    ? POLITICIANS.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.state.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : POLITICIANS;

  return (
    <div className="w-full">
      <div className="mb-4">
        <label htmlFor="politician-search" className="block text-sm font-medium mb-2">
          Select a Politician
        </label>
        <input
          id="politician-search"
          type="text"
          placeholder="Search by name, party, or state..."
          className="w-full p-3 bg-card-bg border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPoliticians.map((politician) => (
          <button
            key={politician.id}
            onClick={() => onSelect(politician)}
            className="flex items-center p-4 bg-card-bg border border-border rounded-md hover:bg-primary/10 transition-colors text-left shadow-md"
          >
            <div className={`w-10 h-10 rounded-full mr-3 flex items-center justify-center text-white font-bold
              ${politician.party === "Democrat" ? "bg-blue-500" : ""}
              ${politician.party === "Republican" ? "bg-red-500" : ""}
              ${politician.party === "Independent" ? "bg-yellow-500" : ""}
            `}>
              {politician.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-medium">{politician.name}</h3>
              <div className="text-sm text-secondary mt-1">
                <span className={`
                  ${politician.party === "Democrat" ? "text-blue-400" : ""}
                  ${politician.party === "Republican" ? "text-red-400" : ""}
                  ${politician.party === "Independent" ? "text-yellow-400" : ""}
                `}>
                  {politician.party}
                </span>
                <span className="mx-1">•</span>
                <span>{politician.position}, {politician.state}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 