"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorNotification from "@/components/ErrorNotification";
import DonationPieChart from "@/components/DonationPieChart";
import { Politician, DonorData } from "@/types";

export default function Home() {
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);
  const [donorData, setDonorData] = useState<DonorData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [isLoadingPoliticians, setIsLoadingPoliticians] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParty, setSelectedParty] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [showIncumbents, setShowIncumbents] = useState<boolean>(true);
  const [showCandidates, setShowCandidates] = useState<boolean>(false);
  
  // Add a new state to track which tab is active
  const [activeTab, setActiveTab] = useState<'members' | 'candidates'>('members');
  
  // Fetch politicians on component mount
  useEffect(() => {
    async function fetchPoliticians() {
      setIsLoadingPoliticians(true);
      try {
        const url = activeTab === 'candidates' 
          ? '/api/politicians?candidates=true'
          : '/api/politicians';
          
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          console.warn("Warning fetching politicians:", data.error);
        }
        
        setPoliticians(data.politicians || []);
      } catch (err) {
        console.error(`Error fetching ${activeTab}:`, err);
        setPoliticians([]); // Set empty array on error
      } finally {
        setIsLoadingPoliticians(false);
      }
    }
    
    fetchPoliticians();
  }, [activeTab]); // Re-fetch when tab changes
  
  // Get unique states from politicians
  const states = [...new Set(politicians.map(p => p.state))].sort();
  
  // Get unique positions from politicians
  const positions = [...new Set(politicians.map(p => p.position))].sort();

  const handlePoliticianSelect = async (politician: Politician) => {
    setSelectedPolitician(politician);
    setIsLoading(true);
    setError(null);
    setIsMockData(false);
    
    try {
      // Enhanced logging to verify CID
      console.log("Selected politician details:", {
        name: politician.name,
        cid: politician.cid,
        party: politician.party,
        state: politician.state,
        position: politician.position
      });
      
      if (!politician.cid || politician.cid === "undefined" || politician.cid === "") {
        throw new Error(`Invalid candidate ID for ${politician.name}. Cannot fetch donor data.`);
      }
      
      console.log(`Fetching donor data for: ${politician.name} with CID: ${politician.cid}`);
      const response = await fetch(`/api/donors?cid=${politician.cid}`);
      const data = await response.json();
      
      console.log("Donor data response:", {
        donorCount: data.donors?.length || 0,
        firstDonor: data.donors?.[0] || null,
        message: data.message || null,
        error: data.error || null
      });

      if (data.isMockData) {
        setIsMockData(true);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (!data.donors || data.donors.length === 0) {
        setError(`No donor data found for ${politician.name}. This could be due to no reported donations in the current election cycle.`);
        setDonorData([]);
      } else {
        setDonorData(data.donors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch donor data");
      setDonorData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Find the dominant industry
  const getDominantIndustry = () => {
    if (!donorData || donorData.length === 0) return null;
    
    const industryMap = new Map<string, number>();
    
    donorData.forEach(donor => {
      const industry = donor.industry || "Unknown";
      const currentAmount = industryMap.get(industry) || 0;
      industryMap.set(industry, currentAmount + donor.amount);
    });
    
    let dominantIndustry = "";
    let highestAmount = 0;
    
    industryMap.forEach((amount, industry) => {
      if (amount > highestAmount) {
        highestAmount = amount;
        dominantIndustry = industry;
      }
    });
    
    return { industry: dominantIndustry, amount: highestAmount };
  };

  const dominantIndustry = donorData ? getDominantIndustry() : null;
  
  // Get top 3 donors
  const getTopDonors = () => {
    if (!donorData || donorData.length === 0) return [];
    return [...donorData].sort((a, b) => b.amount - a.amount).slice(0, 3);
  };
  
  // Filter politicians
  const filteredPoliticians = politicians.filter(politician => {
    // Filter by search term
    const matchesSearch = searchTerm === "" || 
      politician.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by party
    const matchesParty = selectedParty === "all" || 
      politician.party === selectedParty;
    
    // Filter by state
    const matchesState = selectedState === "all" || 
      politician.state === selectedState;
    
    // Filter by position
    const matchesPosition = selectedPosition === "all" || 
      politician.position === selectedPosition;
    
    // Update the status filter logic to properly handle incumbents and candidates
    const matchesStatus = 
      (!showIncumbents && !showCandidates) || // Show all if neither is selected
      (showIncumbents && showCandidates) ||   // Show all if both are selected
      (showIncumbents && politician.isIncumbent) || 
      (showCandidates && politician.isCandidate);
    
    return matchesSearch && matchesParty && matchesState && matchesPosition && matchesStatus;
  });
  
  // Group politicians by state for the state view
  const politiciansByState = states.reduce((acc, state) => {
    const stateMatches = filteredPoliticians.filter(p => p.state === state);
    if (stateMatches.length > 0) {
      acc[state] = stateMatches;
    }
    return acc;
  }, {} as Record<string, Politician[]>);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero section */}
      {!selectedPolitician && (
        <div className="relative bg-gradient-to-b from-primary/20 to-background py-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <motion.h1 
              className="text-4xl md:text-6xl font-bold mb-4 text-foreground"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Follow the Money
            </motion.h1>
            <motion.p 
              className="text-xl md:text-2xl text-foreground/80 mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Discover who's really funding U.S. politicians and understand whose interests they truly represent.
            </motion.p>
            
            <motion.div
              className="flex flex-wrap justify-center gap-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="flex items-center bg-card-bg rounded-full px-5 py-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                <span>Democrats</span>
              </div>
              <div className="flex items-center bg-card-bg rounded-full px-5 py-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                <span>Republicans</span>
              </div>
              <div className="flex items-center bg-card-bg rounded-full px-5 py-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                <span>Independents</span>
              </div>
            </motion.div>
            
            <motion.div
              className="bg-black/40 backdrop-blur-sm p-6 rounded-xl max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <p className="text-foreground/90 mb-4">
                Political donations shape policy decisions that affect your daily life. Our tool reveals the money trail behind each politician, showing you exactly which industries have the most influence.
              </p>
              <p className="text-primary font-medium">
                Select a politician below to see who's funding them.
              </p>
            </motion.div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!selectedPolitician && (
          <>
            {/* Filters */}
            <div className="mb-8 bg-card-bg rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4">Find Politicians</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label htmlFor="search" className="block text-sm font-medium mb-1 text-secondary">
                    Search
                  </label>
                  <input
                    id="search"
                    type="text"
                    placeholder="Search by name..."
                    className="w-full p-2 bg-background border border-border rounded-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="party" className="block text-sm font-medium mb-1 text-secondary">
                    Party
                  </label>
                  <select
                    id="party"
                    className="w-full p-2 bg-background border border-border rounded-md"
                    value={selectedParty}
                    onChange={(e) => setSelectedParty(e.target.value)}
                  >
                    <option value="all">All Parties</option>
                    <option value="Democrat">Democrat</option>
                    <option value="Republican">Republican</option>
                    <option value="Independent">Independent</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="state" className="block text-sm font-medium mb-1 text-secondary">
                    State
                  </label>
                  <select
                    id="state"
                    className="w-full p-2 bg-background border border-border rounded-md"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="all">All States</option>
                    {states.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="position" className="block text-sm font-medium mb-1 text-secondary">
                    Position
                  </label>
                  <select
                    id="position"
                    className="w-full p-2 bg-background border border-border rounded-md"
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                  >
                    <option value="all">All Positions</option>
                    {positions.map(position => (
                      <option key={position} value={position}>{position}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Then add the tab UI */}
              <div className="flex space-x-2 mb-4">
                <button
                  className={`px-4 py-2 rounded-md ${
                    activeTab === 'members' ? 'bg-primary text-white' : 'bg-card-bg text-secondary'
                  }`}
                  onClick={() => setActiveTab('members')}
                >
                  Current Members
                </button>
                <button
                  className={`px-4 py-2 rounded-md ${
                    activeTab === 'candidates' ? 'bg-primary text-white' : 'bg-card-bg text-secondary'
                  }`}
                  onClick={() => setActiveTab('candidates')}
                >
                  Candidates
                </button>
              </div>
              
              <div className="text-sm text-secondary">
                Showing {filteredPoliticians.length} politicians
                {selectedParty !== "all" && ` from the ${selectedParty} party`}
                {selectedState !== "all" && ` in ${selectedState}`}
                {selectedPosition !== "all" && ` serving as ${selectedPosition}s`}
              </div>
            </div>
            
            {/* Display by state if state filter is not applied */}
            {selectedState === "all" ? (
              <div className="space-y-8">
                {Object.entries(politiciansByState).map(([state, politicians]) => (
                  <div key={state} className="bg-card-bg rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold mb-4 flex items-center">
                      <span className="text-primary mr-2">{state}</span>
                      <span className="text-sm font-normal text-secondary">
                        ({politicians.length} {politicians.length === 1 ? 'politician' : 'politicians'})
                      </span>
                    </h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {politicians.map(politician => (
                        <motion.button
                          key={politician.id}
                          onClick={() => handlePoliticianSelect(politician)}
                          className="flex flex-col items-center p-4 bg-background rounded-lg hover:bg-primary/10 transition-all card-hover"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <div className={`w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white text-xl font-bold
                            ${politician.party === "Democrat" ? "bg-blue-500" : ""}
                            ${politician.party === "Republican" ? "bg-red-500" : ""}
                            ${politician.party === "Independent" ? "bg-yellow-500" : ""}
                          `}>
                            {politician.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-center">{politician.name}</span>
                          <span className="text-xs text-secondary">{politician.position}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card-bg rounded-xl p-6 shadow-lg">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredPoliticians.map(politician => (
                    <motion.button
                      key={politician.id}
                      onClick={() => handlePoliticianSelect(politician)}
                      className="flex flex-col items-center p-4 bg-background rounded-lg hover:bg-primary/10 transition-all card-hover"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className={`w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white text-xl font-bold
                        ${politician.party === "Democrat" ? "bg-blue-500" : ""}
                        ${politician.party === "Republican" ? "bg-red-500" : ""}
                        ${politician.party === "Independent" ? "bg-yellow-500" : ""}
                      `}>
                        {politician.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-center">{politician.name}</span>
                      <span className="text-xs text-secondary">{politician.position}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <ErrorNotification message={error} />}

        {isLoading && (
          <div className="flex justify-center my-12">
            <LoadingSpinner />
          </div>
        )}

        {isMockData && !error && (
          <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-200 p-3 rounded-md mb-4 text-sm">
            Note: Showing sample data (API unavailable)
          </div>
        )}

        {selectedPolitician && donorData && !isLoading && (
          <motion.div 
            className="bg-card-bg rounded-xl overflow-hidden shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Back button */}
            <button 
              onClick={() => {
                setSelectedPolitician(null);
                setDonorData(null);
              }}
              className="absolute top-4 left-4 text-secondary hover:text-primary"
            >
              ← Back
            </button>
            
            {/* Politician info */}
            <div className="flex flex-col md:flex-row">
              <div className="p-8 md:w-1/3 bg-gradient-to-b from-black/30 to-transparent">
                <div className="flex flex-col items-center md:items-start">
                  <div className={`w-28 h-28 rounded-full mb-4 flex items-center justify-center text-white text-3xl font-bold shadow-lg
                    ${selectedPolitician.party === "Democrat" ? "bg-blue-500" : ""}
                    ${selectedPolitician.party === "Republican" ? "bg-red-500" : ""}
                    ${selectedPolitician.party === "Independent" ? "bg-yellow-500" : ""}
                  `}>
                    {selectedPolitician.name.charAt(0)}
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-1">{selectedPolitician.name}</h2>
                  <div className="flex items-center mb-6">
                    <span className={`inline-block w-3 h-3 rounded-full mr-2
                      ${selectedPolitician.party === "Democrat" ? "bg-blue-500" : ""}
                      ${selectedPolitician.party === "Republican" ? "bg-red-500" : ""}
                      ${selectedPolitician.party === "Independent" ? "bg-yellow-500" : ""}
                    `}></span>
                    <span className="text-secondary">
                      {selectedPolitician.party}, {selectedPolitician.state} • {selectedPolitician.position}
                    </span>
                  </div>
                  
                  {/* Top donors */}
                  <div className="w-full">
                    <h3 className="text-sm font-medium mb-3 text-secondary uppercase tracking-wider">Top Donors</h3>
                    <ul className="space-y-3">
                      {getTopDonors().map((donor, index) => (
                        <li key={index} className="bg-black/20 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{donor.name}</span>
                            <span className="font-mono text-primary">${donor.amount.toLocaleString()}</span>
                          </div>
                          {donor.industry && (
                            <div className="text-xs text-secondary mt-1">
                              Industry: {donor.industry}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Charts and conclusion */}
              <div className="p-8 md:w-2/3 bg-black/10">
                <div className="h-[250px] mb-8">
                  <h3 className="text-sm font-medium mb-3 text-secondary uppercase tracking-wider">Funding Breakdown</h3>
                  <DonationPieChart donors={donorData || []} type="industry" />
                </div>
                
                <div className="mt-8 border-t border-border pt-6">
                  <h2 className="text-2xl font-bold mb-4">The Bottom Line</h2>
                  
                  {dominantIndustry ? (
                    <div className="mb-6">
                      <div className="text-4xl font-bold text-primary mb-3">
                        {dominantIndustry.industry}
                      </div>
                      <p className="text-xl leading-relaxed">
                        {selectedPolitician.name} primarily serves the interests of the <strong>{dominantIndustry.industry}</strong> industry, 
                        which has contributed <strong>${dominantIndustry.amount.toLocaleString()}</strong> to their campaign.
                      </p>
                      
                      <div className="mt-6 p-4 bg-primary/10 border-l-4 border-primary rounded-r-lg">
                        <h4 className="font-bold mb-2">What this means for you:</h4>
                        <p>
                          Politicians often align their policy positions with their largest donors. 
                          With significant funding from the {dominantIndustry.industry.toLowerCase()} sector, 
                          {selectedPolitician.name}'s voting record and policy priorities are likely influenced 
                          by these financial relationships.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="text-4xl font-bold text-gray-500 mb-3">
                        No Dominant Industry
                      </div>
                      <p className="text-xl leading-relaxed">
                        No significant donor data is available for {selectedPolitician.name} in the current election cycle.
                        This could be because they haven't reported donations yet, or because their campaign is just beginning.
                      </p>
                      
                      <div className="mt-6 p-4 bg-gray-800/50 border-l-4 border-gray-500 rounded-r-lg">
                        <h4 className="font-bold mb-2">What this means:</h4>
                        <p>
                          Without donor data, it's difficult to determine which industries might influence 
                          {selectedPolitician.name}'s policy positions. Check back later as more campaign finance 
                          data becomes available.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <a 
                    href={selectedPolitician.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mt-4 text-primary hover:underline"
                  >
                    <span>See full donor profile on OpenSecrets</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="bg-card-bg py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-secondary mb-2">
            Data sourced from <a href="https://www.opensecrets.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenSecrets.org</a>
          </p>
          <p className="text-xs text-secondary">
            © {new Date().getFullYear()} Follow the Money • Understanding political influence through campaign finance
          </p>
        </div>
      </footer>
    </div>
  );
}
