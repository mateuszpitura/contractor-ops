import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md ring-1 ring-foreground/[0.03]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
