import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { JobCategorySlug } from "@findgigs/validators";
import { JOB_CATEGORIES, WorkerProfileSchema } from "@findgigs/validators";

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
      jobCategories: [] as JobCategorySlug[],
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

            <form.Field name="jobCategories">
              {(field) => (
                <CategoryChips
                  value={field.state.value}
                  onChange={field.handleChange}
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

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

// ---------------------------------------------------------------------------
// CategoryChips — multi-select chip grid, source of truth is JOB_CATEGORIES
// from @findgigs/validators (same constant the seed script uses).
// ---------------------------------------------------------------------------

interface CategoryChipsProps {
  value: JobCategorySlug[];
  onChange: (next: JobCategorySlug[]) => void;
  errors: readonly unknown[];
}

function CategoryChips({ value, onChange, errors }: CategoryChipsProps) {
  const selected = new Set(value);
  const hasError = errors.length > 0;

  return (
    <View className="gap-3">
      <Text className="text-foreground text-sm font-medium">
        What kind of work interests you?
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {JOB_CATEGORIES.map((cat) => {
          const isSelected = selected.has(cat.slug);
          return (
            <Pressable
              key={cat.slug}
              onPress={() => {
                const next = new Set(selected);
                if (isSelected) next.delete(cat.slug);
                else next.add(cat.slug);
                onChange(Array.from(next));
              }}
              className={cn(
                "rounded-full border px-4 py-2",
                isSelected
                  ? "border-primary bg-accent"
                  : "border-border bg-card",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-foreground",
                )}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hasError && (
        <Text className="text-destructive text-xs">
          Select at least one job category
        </Text>
      )}
    </View>
  );
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
