interface TopBarProps {
  onCreateNamespace: () => void;
}

export function TopBar({ onCreateNamespace }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="action-btn" onClick={onCreateNamespace} title="Add namespace">
          + Namespace
        </button>
      </div>
    </div>
  );
}
