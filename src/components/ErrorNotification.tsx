interface ErrorNotificationProps {
  message: string;
}

export default function ErrorNotification({ message }: ErrorNotificationProps) {
  return (
    <div className="bg-red-900/30 border border-red-700 text-red-200 p-4 rounded-md mb-6">
      <h3 className="font-medium mb-1">Error</h3>
      <p>{message}</p>
    </div>
  );
} 