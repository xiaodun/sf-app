import { useNavigation } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TrashedUnit, loadTrashedUnits } from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";

export default function TrashScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trashedUnits, setTrashedUnits] = useState<TrashedUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await loadTrashedUnits(id);
      setTrashedUnits(data);
    } catch (error) {
      console.error("加载回收站数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 首次加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <Stack.Screen
        options={{
          title: loading ? "" : "回收站",
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push(`/collection/${id}` as any);
                }
              }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      <ThemedView style={styles.container}>
        {loading ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.loadingText}>加载中...</ThemedText>
          </ThemedView>
        ) : trashedUnits.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyStateText}>回收站为空</ThemedText>
          </ThemedView>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.unitsContainer}>
              {trashedUnits.map((item, index) => (
                <View key={`${item.unit.id}-${index}`} style={styles.unitRow}>
                  <ThemedText style={styles.unitRowText}>
                    {item.levelName} + {item.unit.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    fontSize: 16,
    color: "#999999",
    textAlign: "center",
    marginTop: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    color: "#999999",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  unitsContainer: {
    paddingVertical: 8,
  },
  unitRow: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  unitRowText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
