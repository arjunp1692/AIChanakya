import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="border-b border-cyan-blue bg-linear-to-r from-dark-navy2 to-primary-navy px-4 py-3 text-white md:px-6">
        <span className="font-bold">Chanakya AI</span>
        <span className="ml-2 text-xs tracking-wider text-cyan-blue uppercase">Kubera Now · CEO Office</span>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-heading-small">Sign in to Chanakya AI</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
