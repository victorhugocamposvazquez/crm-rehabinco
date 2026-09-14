"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginFormValues) {
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : authError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-[400px] rounded-[14px] border border-border bg-white p-8">
        <div className="mb-6 flex justify-center">
          <img
            src="/images/logo-login.png"
            alt="REHABINCO"
            className="h-16 w-auto object-contain"
          />
        </div>
        <h1 className="mb-6 text-center text-[22px] font-semibold tracking-tight">Entrar</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <p className="rounded-[9px] bg-[var(--red-bg)] px-3 py-2 text-[13px] text-[var(--red)]">{error}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-[12px] text-[var(--red)]">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <span className="text-[12px] text-[var(--text-3)]">¿La has olvidado?</span>
            </div>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-[12px] text-[var(--red)]">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="mt-2 h-12 w-full text-[15px]" disabled={isSubmitting}>
            {isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
