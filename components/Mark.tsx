/**
 * Kindred's mark: one root, branches that split. The solid branch is the one the
 * evidence supports; the dashed one is resemblance without a supported route.
 */
export function KindredMark({ size = 46 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path className="mark-stem" d="M24 44 V26" />
      <path className="mark-branch solid" d="M24 26 C24 18, 14 16, 12 8" />
      <path className="mark-branch dashed" d="M24 26 C24 18, 34 16, 36 8" />
      <circle cx="24" cy="44" r="2.6" className="mark-root" />
      <circle cx="12" cy="8" r="3" className="mark-leaf solid" />
      <circle cx="36" cy="8" r="3" className="mark-leaf hollow" />
    </svg>
  );
}
