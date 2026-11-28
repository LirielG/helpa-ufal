import { ActionsList } from "../features/profile/components/ActionsList";
import bgDashboard from "../assets/bg.svg";

export function MyActivities() {
  return (
    <div
      className="w-full flex-1"
      style={{
        backgroundImage: `url(${bgDashboard})`,
        backgroundPosition: "top center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="page-container py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <ActionsList />
        </div>
      </div>
    </div>
  );
}
