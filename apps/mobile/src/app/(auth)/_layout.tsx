import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Slot, Stack } from "expo-router";

import { Text } from "~/components/ui/text";

export default function AuthLayout() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="bg-background flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="flex-grow justify-center px-6 py-8"
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo and app name */}
            <View className="mb-8 items-center">
              <View className="bg-primary mb-3 h-16 w-16 items-center justify-center rounded-2xl">
                <Text className="text-primary-foreground text-2xl font-bold">
                  F
                </Text>
              </View>
              <Text className="text-foreground text-2xl font-bold">
                FindGigs
              </Text>
              <Text className="text-muted-foreground mt-1 text-base">
                Find flexible gigs near you
              </Text>
            </View>

            {/* Screen content (signup or login form) */}
            <Slot />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
