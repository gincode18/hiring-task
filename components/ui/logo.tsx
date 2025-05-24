import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Avatar className="h-16 w-16 ">
        <AvatarImage
          src="/periskope-icon.webp"
          alt="Periskope"
          className="object-contain"
        />
        <AvatarFallback className="bg-green-600 text-white font-bold">
          P
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
