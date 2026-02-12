"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [redirect, setRedirect] = useState("/");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRedirect(params.get("redirect") ?? "/");
  }, []);

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
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setError(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f6f9] px-4 py-12 md:min-h-screen md:py-16">
      <Card className="w-full max-w-[420px] animate-[scaleIn_0.25s_ease-out] border-0 bg-white px-8 py-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] md:px-12 md:py-14 md:shadow-[0_8px_40px_rgba(0,0,0,0.08)]" animate={false}>
        <CardHeader className="space-y-4 pb-8 text-center">
          <div className="flex justify-center">
            <img
              src="/images/logo-login.png"
              alt="REHABINCO - Gestión Inmobiliaria y Reformas"
              className="h-24 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-[2rem] font-semibold tracking-tight text-neutral-900 md:text-[2.25rem]">
            CRM interno
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="space-y-2.5">
              <Input
                id="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                className="h-12 rounded-xl border-neutral-200 px-4 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-[#29A4AE]/40 focus-visible:ring-offset-0"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2.5">
              <Input
                id="password"
                type="password"
                placeholder="Contraseña"
                autoComplete="current-password"
                className="h-12 rounded-xl border-neutral-200 px-4 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-[#29A4AE]/40 focus-visible:ring-offset-0"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="mt-2 h-12 w-full rounded-xl bg-[#29A4AE] text-base font-semibold text-white hover:bg-[#23908a] focus-visible:ring-[#29A4AE]/40"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
