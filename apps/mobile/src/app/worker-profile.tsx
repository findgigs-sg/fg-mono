import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { JobCategorySlug } from "@findgigs/validators";
import { WorkerProfileSchema } from "@findgigs/validators";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import { trpc } from "~/utils/api";

export default function WorkerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const completeWorkerProfileMutation = useMutation({
    ...trpc.profile.completeWorkerProfile.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.profile.getMyProfile.queryKey(),
      });
      router.replace("/");
    },
    onError: (error) => {
      Alert.alert("Couldn't save profile", error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      fullName: "",
      phone: "",
      bio: "" as string | undefined,
      photoUrl: undefined as string | undefined,
      // Hardcoded placeholder for scaffold — replaced by CategoryChips in Task 10
      jobCategories: ["events"] as JobCategorySlug[],
    },
    validators: {
      // Cast needed: Zod's optional() emits `bio?:` but TanStack Form expects `bio: T | undefined`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange: WorkerProfileSchema as any,
    },
    onSubmit: ({ value }) => {
      completeWorkerProfileMutation.mutate({
        fullName: value.fullName,
        phone: value.phone,
        bio: value.bio?.trim() ? value.bio : undefined,
        photoUrl: value.photoUrl,
        jobCategories: value.jobCategories,
      });
    },
  });

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-6 px-6 pt-10">
            {/* Header */}
            <View className="gap-2">
              <Text className="text-foreground text-2xl font-bold">
                Set up your profile
              </Text>
              <Text className="text-muted-foreground text-sm">
                Help employers get to know you
              </Text>
            </View>

            {/* Full Name */}
            <form.Field name="fullName">
              {(field) => (
                <LabeledField
                  label="Full Name"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="Jane Doe"
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            {/* Phone */}
            <form.Field name="phone">
              {(field) => (
                <LabeledField
                  label="Phone Number"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="+65 1234 5678"
                  keyboardType="phone-pad"
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            {/* Bio */}
            <form.Field name="bio">
              {(field) => (
                <LabeledField
                  label="Short Bio (Optional)"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="Tell employers a bit about yourself"
                  multiline
                  maxLength={300}
                  counter
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            {/* Placeholder for chips — Task 10 replaces this */}
            <View className="gap-2">
              <Text className="text-foreground text-sm font-medium">
                Job categories (scaffold — placeholder)
              </Text>
              <Text className="text-muted-foreground text-xs">
                Currently hardcoded to ["events"]. Task 10 replaces this with a
                tappable chip grid.
              </Text>
            </View>

            {/* Submit button */}
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  size="lg"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    completeWorkerProfileMutation.isPending
                  }
                  onPress={() => form.handleSubmit()}
                >
                  <Text className="text-primary-foreground font-semibold">
                    {completeWorkerProfileMutation.isPending
                      ? "Saving…"
                      : "Complete Profile"}
                  </Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// LabeledField — internal helper for labeled TextInput + error display.
// ---------------------------------------------------------------------------

interface LabeledFieldProps {
  label: string;
  value: string | undefined;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
  maxLength?: number;
  counter?: boolean;
  errors: readonly unknown[];
}

function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  maxLength,
  counter,
  errors,
}: LabeledFieldProps) {
  const hasError = errors.length > 0;
  return (
    <View className="gap-1.5">
      <Text className="text-foreground text-sm font-medium">{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        maxLength={maxLength}
        className={cn(
          "border-border bg-card text-foreground rounded-2xl border px-4 py-3 text-base",
          multiline && "h-24",
          hasError && "border-destructive",
        )}
      />
      {counter && maxLength && (
        <Text className="text-muted-foreground text-right text-xs">
          {(value ?? "").length} / {maxLength}
        </Text>
      )}
      {hasError && (
        <Text className="text-destructive text-xs">
          {String(errors[0] ?? "")}
        </Text>
      )}
    </View>
  );
}
