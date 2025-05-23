import { Phone } from "lucide-react";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-green-600 p-2 ${className}`}>
      <Phone className="h-6 w-6 text-white" />
    </div>
  );
}