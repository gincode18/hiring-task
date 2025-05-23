import { RegisterForm } from "@/components/auth/register-form";
import { Logo } from "@/components/ui/logo";

export default function RegisterPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-r from-green-50 to-green-100">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center justify-center space-y-2">
          <Logo className="h-12 w-12 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
          <p className="text-sm text-gray-500">
            Sign up to start chatting with your team
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}