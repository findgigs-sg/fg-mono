import { ScrollView, Text, View } from "react-native";
import { usePathname } from "expo-router";

import "../styles.css";

export default function Index() {
  const pathname = usePathname();

  console.log("[INDEX] rendering, pathname:", pathname);

  return (
    <ScrollView className="bg-background flex-1">
      <View className="p-10">
        <Text className="text-foreground text-3xl font-bold">
          text-foreground
        </Text>
        <Text className="text-foreground mt-2 text-base">
          current route: {pathname}
        </Text>
        <View className="bg-primary mt-4 rounded-lg p-4">
          <Text className="text-primary-foreground text-xl">bg-primary</Text>
        </View>
        <View className="bg-secondary mt-4 rounded-lg p-4">
          <Text className="text-secondary-foreground text-xl">
            bg-secondary
          </Text>
        </View>
        <View className="bg-destructive mt-4 rounded-lg p-4">
          <Text className="text-destructive-foreground text-xl">
            bg-destructive
          </Text>
        </View>
        <View className="bg-muted mt-4 rounded-lg p-4">
          <Text className="text-muted-foreground text-xl">bg-muted</Text>
        </View>
      </View>
    </ScrollView>
  );
}
