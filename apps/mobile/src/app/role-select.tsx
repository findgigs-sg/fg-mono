import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import { trpc } from "~/utils/api";

type Role = "worker" | "employer";

interface RoleCardProps {
  role: Role;
  selected: boolean;
  onPress: () => void;
}

function RoleCard({ role, selected, onPress }: RoleCardProps) {
  const title =
    role === "worker" ? "I'm looking for work" : "I'm hiring workers";
  const description =
    role === "worker"
      ? "Find and apply for flexible shifts near you"
      : "Post gigs and find reliable short-term staff";

  return (
    <Pressable onPress={onPress}>
      <View
        className={cn(
          "flex-row gap-3 rounded-2xl border-2 p-5",
          selected ? "border-primary bg-accent" : "border-border bg-card",
        )}
      >
        <View className="bg-accent h-12 w-12 items-center justify-center rounded-full">
          <Text className="text-primary text-xl font-bold">
            {role === "worker" ? "W" : "E"}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-foreground text-base font-semibold">
            {title}
          </Text>
          <Text className="text-muted-foreground text-sm">{description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const setRoleMutation = useMutation(trpc.profile.setRole.mutationOptions());

  const onContinue = () => {
    if (!selectedRole) return;
    setRoleMutation.mutate(
      { role: selectedRole },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: trpc.profile.getMyProfile.queryKey(),
          });
          router.replace(
            selectedRole === "worker" ? "/worker-profile" : "/employer-profile",
          );
        },
        onError: (error) => {
          Alert.alert("Error", error.message || "Something went wrong");
        },
      },
    );
  };

  const continueDisabled = !selectedRole || setRoleMutation.isPending;
  const continueLabel = setRoleMutation.isPending ? "Saving…" : "Continue";

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <View className="flex-1 gap-7 px-6 pt-10 pb-6">
        <View className="gap-2">
          <Text className="text-foreground text-2xl font-bold">
            How do you want to use FindGigs?
          </Text>
          <Text className="text-muted-foreground text-sm">
            This can't be changed later
          </Text>
        </View>

        <View className="gap-4">
          <RoleCard
            role="worker"
            selected={selectedRole === "worker"}
            onPress={() => {
              if (setRoleMutation.isPending) return;
              setSelectedRole("worker");
            }}
          />
          <RoleCard
            role="employer"
            selected={selectedRole === "employer"}
            onPress={() => {
              if (setRoleMutation.isPending) return;
              setSelectedRole("employer");
            }}
          />
        </View>

        <View className="flex-1" />

        <Button size="lg" disabled={continueDisabled} onPress={onContinue}>
          <Text className="text-primary-foreground font-semibold">
            {continueLabel}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
