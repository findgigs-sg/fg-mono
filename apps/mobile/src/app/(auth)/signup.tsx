import { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useForm } from "@tanstack/react-form";

import { SignUpSchema } from "@findgigs/validators";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Text } from "~/components/ui/text";
import { authClient } from "~/utils/auth";

export default function SignUpScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/role-select",
      });
      router.replace("/role-select");
    } catch (_error) {
      Alert.alert(
        "Error",
        "Sign in was cancelled or failed. Please try again.",
      );
    }
  };

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: SignUpSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      try {
        const { error } = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: "", // Collected during onboarding
        });
        if (error) {
          Alert.alert(
            "Error",
            error.code === "USER_ALREADY_EXISTS"
              ? "Account already exists, try logging in"
              : (error.message ?? "Something went wrong"),
          );
          return;
        }
        router.replace("/role-select");
      } catch (_error) {
        Alert.alert("Error", "Connection error, please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <View className="gap-6">
      {/* Social auth buttons */}
      <View className="gap-3">
        <Button
          variant="outline"
          size="lg"
          onPress={() => handleSocialSignIn("google")}
        >
          <Text>Continue with Google</Text>
        </Button>
        <Button
          size="lg"
          className="bg-black"
          onPress={() => handleSocialSignIn("apple")}
        >
          <Text className="text-white">Continue with Apple</Text>
        </Button>
      </View>

      {/* Divider */}
      <View className="flex-row items-center gap-4">
        <Separator className="flex-1" />
        <Text className="text-muted-foreground text-sm">or</Text>
        <Separator className="flex-1" />
      </View>

      {/* Email/password form */}
      <View className="gap-4">
        <form.Field name="email">
          {(field) => (
            <View className="gap-1.5">
              <Input
                placeholder="your@email.com"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {field.state.meta.errors.length > 0 && (
                <Text className="text-destructive text-sm">
                  {field.state.meta.errors[0]?.message}
                </Text>
              )}
            </View>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <View className="gap-1.5">
              <View className="relative">
                <Input
                  placeholder="Min 8 characters"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text className="text-muted-foreground text-xs">
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Button>
              </View>
              {field.state.meta.errors.length > 0 && (
                <Text className="text-destructive text-sm">
                  {field.state.meta.errors[0]?.message}
                </Text>
              )}
            </View>
          )}
        </form.Field>

        <Button size="lg" onPress={form.handleSubmit} disabled={isSubmitting}>
          <Text className="text-primary-foreground font-semibold">
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </Text>
        </Button>
      </View>

      {/* Footer */}
      <View className="items-center gap-2">
        <View className="flex-row">
          <Text className="text-muted-foreground text-sm">
            Already have an account?{" "}
          </Text>
          <Text
            className="text-primary text-sm font-semibold"
            onPress={() => router.push("/(auth)/login")}
          >
            Log In
          </Text>
        </View>
        <Text className="text-muted-foreground text-center text-xs">
          By signing up you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}
