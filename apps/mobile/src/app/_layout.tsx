import { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

import "../styles.css";

void SplashScreen.preventAutoHideAsync();

// Matches the file at apps/mobile/src/app/role-select.tsx.
// If that file is renamed or moved into a group, update this constant.
const ROLE_SELECT_SEGMENT = "role-select";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: profileData, isPending: profilePending } = useQuery({
    ...trpc.profile.getMyProfile.queryOptions(),
    enabled: !!session,
  });
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionPending) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inRoleSelect = segments[0] === ROLE_SELECT_SEGMENT;

    // Rule 1: no session → go to signup
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/signup");
      return;
    }

    // Rule 2: already signed in but visiting auth → kick to home
    if (session && inAuthGroup) {
      router.replace("/");
      return;
    }

    // Rule 3 (FIN-8 minimal gate): session, profile query resolved,
    // no profile row yet → send the user to role selection.
    // Fail-open: if profileData is undefined (query errored or not
    // yet started), we do NOT redirect. This prevents network flakes
    // from bouncing users onto role-select incorrectly.
    if (
      session &&
      !profilePending &&
      profileData &&
      !profileData.profile &&
      !inRoleSelect
    ) {
      router.replace("/role-select");
      return;
    }
  }, [session, sessionPending, profileData, profilePending, segments, router]);

  if (sessionPending) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colorScheme === "dark" ? "#0F172A" : "#FFFFFF",
            },
          }}
        />
      </AuthGuard>
      <StatusBar />
    </QueryClientProvider>
  );
}
