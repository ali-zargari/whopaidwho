"use client";

import { useState } from "react";
import Image from "next/image";
import { Politician } from "@/types";

interface CongressSelectorProps {
  politicians: Politician[];
  onSelect: (politician: Politician) => void;
}

export default function CongressSelector({ politicians, onSelect }: CongressSelectorProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);
  const [view, setView] = useState<"senate" | "house">("senate");
  
  // Map politicians to their positions in the visualization
  const senatePositions = politicians
    .filter(p => p.position === "Senator")
    .map((politician, index) => {
      // Calculate position in a semi-circle layout
      const totalSeats = politicians.filter(p => p.position === "Senator").length;
      const angle = (Math.PI / (totalSeats + 1)) * (index + 1);
      const radius = 150;
      const x = 200 + Math.cos(angle) * radius;
      const y = 200 + Math.sin(angle) * radius;
      
      return {
        ...politician,
        x,
        y
      };
    });
  
  const housePositions = politicians
    .filter(p => p.position === "Representative")
    .map((politician, index) => {
      // Calculate position in a grid layout
      const totalSeats = politicians.filter(p => p.position === "Representative").length;
      const rows = Math.ceil(Math.sqrt(totalSeats));
      const cols = Math.ceil(totalSeats / rows);
      const row = Math.floor(index / cols);
      const col = index % cols;
      const spacing = 40;
      const x = 100 + col * spacing;
      const y = 100 + row * spacing;
      
      return {
        ...politician,
        x,
        y
      };
    });
  
  const positions = view === "senate" ? senatePositions : housePositions;
  
  return (
    <div className="w-full mb-8">
      <div className="flex justify-center mb-4 space-x-4">
        <button
          className={`px-4 py-2 rounded-md ${view === "senate" ? "bg-primary text-white" : "bg-card-bg"}`}
          onClick={() => setView("senate")}
        >
          Senate View
        </button>
        <button
          className={`px-4 py-2 rounded-md ${view === "house" ? "bg-primary text-white" : "bg-card-bg"}`}
          onClick={() => setView("house")}
        >
          House View
        </button>
      </div>
      
      <div className="relative w-full h-[400px] bg-card-bg border border-border rounded-lg overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image 
            src="/congress-chamber.jpg" 
            alt="Congress Chamber" 
            fill 
            style={{ objectFit: "cover" }}
          />
        </div>
        
        <div className="relative w-full h-full">
          {positions.map((politician) => (
            <button
              key={politician.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full 
                ${politician.party === "Democrat" ? "bg-blue-500" : ""}
                ${politician.party === "Republican" ? "bg-red-500" : ""}
                ${politician.party === "Independent" ? "bg-yellow-500" : ""}
                hover:ring-2 hover:ring-white transition-all
                ${hoveredSeat === politician.id ? "ring-2 ring-white scale-125" : ""}
              `}
              style={{ 
                left: `${politician.x}px`, 
                top: `${politician.y}px` 
              }}
              onClick={() => onSelect(politician)}
              onMouseEnter={() => setHoveredSeat(politician.id)}
              onMouseLeave={() => setHoveredSeat(null)}
            >
              <span className="sr-only">{politician.name}</span>
            </button>
          ))}
          
          {hoveredSeat && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-md">
              {politicians.find(p => p.id === hoveredSeat)?.name} ({politicians.find(p => p.id === hoveredSeat)?.party.charAt(0)}-{politicians.find(p => p.id === hoveredSeat)?.state})
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
          <span className="text-sm">Democrat</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
          <span className="text-sm">Republican</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
          <span className="text-sm">Independent</span>
        </div>
      </div>
    </div>
  );
} 