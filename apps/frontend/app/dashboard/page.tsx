export default function DashboardHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          Select a sidebar section to view your dashboard tools and reports.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Admin Overview",
            description: "Manage hospitals, users, and settings.",
          },
          {
            title: "Doctor Workspace",
            description: "View appointments, patients, and prescriptions.",
          },
          {
            title: "Patient Center",
            description: "Book appointments and review your health records.",
          },
          {
            title: "Reception Desk",
            description: "Handle appointments, patients, and billing.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="card p-6 border border-gray-200 rounded-2xl"
          >
            <h2 className="text-xl font-semibold text-gray-900">
              {card.title}
            </h2>
            <p className="mt-3 text-sm text-gray-500">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
