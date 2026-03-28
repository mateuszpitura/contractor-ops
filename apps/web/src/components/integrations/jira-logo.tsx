/**
 * Jira Cloud logo mark (two overlapping triangles).
 * Uses Jira's official brand blue (#0052CC) — not theme-dependent.
 */
export function JiraLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="jira-grad-a"
          x1="98.03%"
          x2="58.89%"
          y1="0.22%"
          y2="40.19%"
        >
          <stop offset="18%" stopColor="#0052CC" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0052CC" />
        </linearGradient>
        <linearGradient
          id="jira-grad-b"
          x1="0.92%"
          x2="40.42%"
          y1="99.65%"
          y2="59.43%"
        >
          <stop offset="18%" stopColor="#0052CC" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0052CC" />
        </linearGradient>
      </defs>
      <path
        d="M27.05 15.04 16.97 4.96 16 4l-8.05 8.05-3 3a.67.67 0 0 0 0 .95L12.52 24.57 16 28.05l8.05-8.05.34-.34-5.87-5.87zm-11.05.48L19.52 12 16 8.48 12.48 12z"
        fill="#0052CC"
      />
      <path
        d="M16 8.48A5.63 5.63 0 0 1 15.98 0L7.95 8.05l4.53 4.47z"
        fill="url(#jira-grad-a)"
      />
      <path
        d="M19.53 15.5 16 19.04a5.63 5.63 0 0 1 .02 8.48l8.03-8.05z"
        fill="url(#jira-grad-b)"
      />
    </svg>
  );
}
