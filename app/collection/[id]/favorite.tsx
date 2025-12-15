import { useNavigation } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
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
import {
  FavoriteUnit,
  loadFavoriteUnits,
  saveFavoriteUnits,
} from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";

export default function FavoriteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [favoriteUnits, setFavoriteUnits] = useState<FavoriteUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // 使用 useLayoutEffect 确保导航配置在渲染前更新
  useLayoutEffect(() => {
    navigation.setOptions({
      title: loading ? "" : "收藏",
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
    });
  }, [navigation, router, id, loading]);

  // 加载收藏数据
  const loadData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await loadFavoriteUnits(id);
      setFavoriteUnits(data);
    } catch (error) {
      console.error("加载收藏数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 首次加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存收藏数据
  useEffect(() => {
    if (!loading && id) {
      saveFavoriteUnits(id, favoriteUnits).catch((error) => {
        console.error("保存收藏数据失败:", error);
      });
    }
  }, [favoriteUnits, loading, id]);

  // 取消收藏
  const handleUnfavorite = useCallback((unitId: string) => {
    setFavoriteUnits((prev) => prev.filter((item) => item.unit.id !== unitId));
  }, []);

  // Stack.Screen 必须在组件顶层，确保始终渲染
  // 使用函数形式的 options 确保每次渲染时都更新配置
  return (
    <>
      <Stack.Screen
        options={{
          title: loading ? "" : "收藏",
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
            <ThemedText style={styles.emptyStateText}>加载中...</ThemedText>
          </ThemedView>
        ) : favoriteUnits.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyStateText}>暂无收藏</ThemedText>
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
            {favoriteUnits.map((item, index) => (
              <View key={`${item.unit.id}-${index}`} style={styles.unitRow}>
                <View style={styles.unitRowContent}>
                  <ThemedText style={styles.unitRowText}>
                    {item.levelName} + {item.unit.name}
                  </ThemedText>
                  {item.reason && (
                    <ThemedText style={styles.unitReasonText}>
                      {item.reason}
                    </ThemedText>
                  )}
                </View>
                <Pressable
                  style={styles.unfavoriteButton}
                  onPress={() => handleUnfavorite(item.unit.id)}
                >
                  <MaterialIcons name="star" size={20} color="#FFA500" />
                </Pressable>
              </View>
            ))}
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
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
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
  unitRowContent: {
    flex: 1,
  },
  unitRowText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
    marginBottom: 4,
  },
  unitReasonText: {
    fontSize: 14,
    color: "#666666",
    marginTop: 4,
  },
  unfavoriteButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});

