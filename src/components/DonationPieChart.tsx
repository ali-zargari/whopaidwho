"use client";

import { useEffect, useRef } from "react";
import { Chart, registerables, ChartData } from "chart.js";
import { DonorData } from "@/types";

Chart.register(...registerables);

interface DonationPieChartProps {
  donors: DonorData[];
  type: "industry" | "donorType";
}

export default function DonationPieChart({ donors, type }: DonationPieChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    
    let chartData: ChartData;
    
    if (type === "industry") {
      // Group donations by industry
      const industryMap = new Map<string, number>();
      
      donors.forEach(donor => {
        const industry = donor.industry || "Unknown";
        const currentAmount = industryMap.get(industry) || 0;
        industryMap.set(industry, currentAmount + donor.amount);
      });
      
      // Sort industries by amount (descending)
      const sortedIndustries = Array.from(industryMap.entries())
        .sort((a, b) => b[1] - a[1]);
      
      // Take top 6 industries and group the rest as "Other"
      const topIndustries = sortedIndustries.slice(0, 6);
      const otherIndustries = sortedIndustries.slice(6);
      
      const labels = topIndustries.map(([industry]) => industry);
      const data = topIndustries.map(([, amount]) => amount);
      
      // Add "Other" category if there are more than 6 industries
      if (otherIndustries.length > 0) {
        const otherTotal = otherIndustries.reduce((sum, [, amount]) => sum + amount, 0);
        labels.push("Other");
        data.push(otherTotal);
      }
      
      // Industry-specific colors
      const industryColors = {
        "Finance/Insurance": "#4C9BE8",
        "Health": "#45C4B0",
        "Energy": "#E8C170",
        "Technology": "#6366F1",
        "Education": "#8B5CF6",
        "Defense": "#F43F5E",
        "Retail": "#EC4899",
        "Government": "#10B981",
        "Telecommunications": "#F59E0B",
        "Entertainment": "#8B5CF6",
        "Conservative Policy": "#EF4444",
        "Women's Issues": "#EC4899",
        "Tobacco": "#92400E",
        "Transportation": "#6366F1",
        "Manufacturing": "#6B7280",
        "Food & Beverage": "#D97706",
        "Other": "#6B7280"
      };
      
      const colors = labels.map(label => {
        const color = industryColors[label as keyof typeof industryColors];
        return color || `hsl(${Math.random() * 360}, 70%, 60%)`;
      });
      
      chartData = {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: "rgba(30, 30, 30, 1)",
          borderWidth: 2,
        }]
      };
    } else {
      // Group by donor type (Corporate, PAC, Individual, etc.)
      const donorTypes = categorizeByDonorType(donors);
      
      const typeColors = {
        "Corporate": "#4C9BE8",
        "PAC": "#F43F5E",
        "Individual": "#10B981",
        "Union": "#F59E0B",
        "University": "#8B5CF6",
        "Government": "#6366F1",
        "Other": "#6B7280"
      };
      
      chartData = {
        labels: Object.keys(donorTypes),
        datasets: [{
          data: Object.values(donorTypes),
          backgroundColor: Object.keys(donorTypes).map(type => 
            typeColors[type as keyof typeof typeColors] || `hsl(${Math.random() * 360}, 70%, 60%)`
          ),
          borderColor: "rgba(30, 30, 30, 1)",
          borderWidth: 2,
        }]
      };
    }
    
    chartInstance.current = new Chart(ctx, {
      type: "pie",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: "rgba(255, 255, 255, 0.8)",
              font: {
                size: 12
              },
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `$${value.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [donors, type]);

  // Helper function to categorize donors by type
  function categorizeByDonorType(donors: DonorData[]) {
    const result: Record<string, number> = {
      "Corporate": 0,
      "PAC": 0,
      "Individual": 0,
      "Union": 0,
      "University": 0,
      "Government": 0,
      "Other": 0
    };
    
    const corporateKeywords = ["Inc", "Corp", "LLC", "Co", "Company", "Group"];
    const pacKeywords = ["PAC", "Committee", "Action", "Fund", "America", "Citizens"];
    const unionKeywords = ["Union", "Workers", "Labor", "Brotherhood", "Association"];
    const universityKeywords = ["University", "College", "School"];
    const governmentKeywords = ["Government", "State of", "Department", "Federal"];
    
    donors.forEach(donor => {
      const name = donor.name;
      
      if (corporateKeywords.some(keyword => name.includes(keyword))) {
        result["Corporate"] += donor.amount;
      } else if (pacKeywords.some(keyword => name.includes(keyword))) {
        result["PAC"] += donor.amount;
      } else if (unionKeywords.some(keyword => name.includes(keyword))) {
        result["Union"] += donor.amount;
      } else if (universityKeywords.some(keyword => name.includes(keyword))) {
        result["University"] += donor.amount;
      } else if (governmentKeywords.some(keyword => name.includes(keyword))) {
        result["Government"] += donor.amount;
      } else {
        result["Other"] += donor.amount;
      }
    });
    
    // Remove categories with zero values
    return Object.fromEntries(
      Object.entries(result).filter(([_, value]) => value > 0)
    );
  }

  return <canvas ref={chartRef} />;
} 