export function EmptyState({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={["rounded-card border border-dashed border-rule-strong bg-paper p-6 text-center text-muted", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
