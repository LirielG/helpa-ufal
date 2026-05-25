interface AlertProps {
  type: "error" | "success" | "warning" | "info";
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const colors = {
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <div className={`border rounded-lg p-4 ${colors[type]} flex justify-between items-center`}>
      <p>{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-lg font-semibold">
          ×
        </button>
      )}
    </div>
  );
};
