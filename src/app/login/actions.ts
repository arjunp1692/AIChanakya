"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "Invalid email or password." };
    throw err; // NEXT_REDIRECT on success
  }
  return {};
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
