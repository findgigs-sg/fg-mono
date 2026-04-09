import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { authClient } from "~/utils/auth";

export default function EmployerProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Text className="text-foreground text-center text-2xl font-bold">
          Employer profile
        </Text>
        <Text className="text-muted-foreground text-center text-base">
          Coming soon (FIN-10)
        </Text>
        <Button
          variant="outline"
          onPress={async () => {
            await authClient.signOut();
            router.replace("/(auth)/signup");
          }}
        >
          <Text>Sign Out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
