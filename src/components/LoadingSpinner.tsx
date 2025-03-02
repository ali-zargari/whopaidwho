export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center">
      <div className="loading-spinner"></div>
      <p className="mt-3 text-secondary">Loading donor data...</p>
    </div>
  );
} 