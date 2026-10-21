type DashboardHeaderProps = {
  title: string;
  subtitle?: string;
  profileName: string;
  profileRole: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardHeader({
  title,
  subtitle,
  profileName,
  profileRole,
}: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">
      <div>
        <h1 className="dashboard-header__title">{title}</h1>
        {subtitle && <p className="dashboard-header__subtitle">{subtitle}</p>}
      </div>

      <div className="profile">
        <span className="profile__avatar" aria-hidden="true">
          {getInitials(profileName)}
        </span>
        <div>
          <p className="profile__name">{profileName}</p>
          <p className="profile__role">{profileRole}</p>
        </div>
      </div>
    </header>
  );
}
