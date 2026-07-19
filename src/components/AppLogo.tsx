import { cn } from "@/lib/utils";

interface AppLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

export function AppLogo({ className, alt = "SUMTRA", ...props }: AppLogoProps) {
  return (
    <img
      src="/sumtra.gif"
      alt={alt}
      className={cn("object-contain", className)}
      {...props}
    />
  );
}
