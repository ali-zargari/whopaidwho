"use client";

import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { DonorData } from "@/types";

Chart.register(...registerables);

interface DonorChartProps {
  donors: DonorData[];
}

export default function DonorChart({ donors }: DonorChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    // Sort donors by amount (descending)
    const sortedDonors = [...donors].sort((a, b) => b.amount - a.amount);
    
    // Create new chart
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    
    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: sortedDonors.map(donor => donor.name),
        datasets: [{
          label: "Donation Amount ($)",
          data: sortedDonors.map(donor => donor.amount),
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const donor = sortedDonors[context.dataIndex];
                let label = `$${context.parsed.x.toLocaleString()}`;
                if (donor.industry) {
                  label += ` (${donor.industry})`;
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              callback: function(value) {
                return "$" + Number(value).toLocaleString();
              },
              color: "rgba(255, 255, 255, 0.7)",
            }
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.7)",
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
  }, [donors]);

  return <canvas ref={chartRef} />;
} 