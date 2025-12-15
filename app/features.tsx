import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Feature, loadFeatures, saveFeatures } from "@/utils/storage";

export default function FeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [featureName, setFeatureName] = useState("");
  const [featureType, setFeatureType] = useState<"numeric" | "single_choice">(
    "numeric"
  );
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);

  // 加载特性列表
  useEffect(() => {
    const loadData = async () => {
      try {
        const allFeatures = await loadFeatures();
        // 只加载全局特性（collectionId 为 "global"）
        const globalFeatures = allFeatures.filter(
          (f) => f.collectionId === "global"
        );
        // 根据 id 去重
        const uniqueFeatures = Array.from(
          new Map(globalFeatures.map((f) => [f.id, f])).values()
        );
        setFeatures(uniqueFeatures);
      } catch (error) {
        console.error("加载特性数据失败:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 保存特性数据（确保所有特性都是全局特性）
  useEffect(() => {
    if (!loading) {
      // 确保所有特性都是全局特性
      const globalFeatures = features.map((f) => ({
        ...f,
        collectionId: "global", // 强制设置为全局特性
      }));

      // 直接保存全局特性，因为所有特性都是全局特性
      saveFeatures(globalFeatures).catch((error) => {
        console.error("保存特性数据失败:", error);
      });
    }
  }, [features, loading]);

  const handleCreateFeature = () => {
    if (featureName.trim()) {
      const newFeature: Feature = {
        id: Date.now().toString(),
        collectionId: "global", // 全局特性
        name: featureName.trim(),
        type: featureType,
        createdAt: Date.now(),
      };
      setFeatures((prev) => [...prev, newFeature]);
      setFeatureName("");
      setFeatureType("numeric");
      setEditingFeatureId(null);
      setModalVisible(false);
    } else {
      Alert.alert("错误", "请输入特性名称");
    }
  };

  const handleEditFeature = (feature: Feature) => {
    setFeatureName(feature.name);
    setFeatureType(feature.type);
    setEditingFeatureId(feature.id);
    setModalVisible(true);
  };

  const handleUpdateFeature = () => {
    if (featureName.trim() && editingFeatureId) {
      setFeatures((prev) =>
        prev.map((feature) =>
          feature.id === editingFeatureId
            ? {
                ...feature,
                collectionId: "global", // 确保更新后仍然是全局特性
                name: featureName.trim(),
                type: featureType,
              }
            : feature
        )
      );
      setFeatureName("");
      setFeatureType("numeric");
      setEditingFeatureId(null);
      setModalVisible(false);
    } else {
      Alert.alert("错误", "请输入特性名称");
    }
  };

  const handleDeleteFeature = (featureId: string) => {
    setFeatures((prev) => prev.filter((item) => item.id !== featureId));
  };

  // Stack.Screen 必须在组件顶层，确保始终渲染
  // 使用 key 确保每次渲染时都更新配置
  return (
    <>
      <Stack.Screen
        key="global-features-screen"
        options={{
          title: "编辑特性",
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                router.push("/");
              }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <ThemedView style={styles.container}>
          <ThemedText style={styles.loadingText}>加载中...</ThemedText>
        </ThemedView>
      ) : (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {features.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  暂无特性，点击下方按钮创建第一个特性
                </ThemedText>
              </ThemedView>
            ) : (
              features.map((feature) => (
                <View key={feature.id} style={styles.featureItem}>
                  <View style={styles.featureHeader}>
                    <View style={styles.featureTitleContainer}>
                      <ThemedText style={styles.featureName}>
                        {feature.name}
                      </ThemedText>
                    </View>
                    <View style={styles.featureActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.iconButtonPressed,
                        ]}
                        onPress={() => handleEditFeature(feature)}
                      >
                        <MaterialIcons name="edit" size={20} color="#007AFF" />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.iconButtonPressed,
                        ]}
                        onPress={() => handleDeleteFeature(feature.id)}
                      >
                        <MaterialIcons
                          name="delete"
                          size={20}
                          color="#FF3B30"
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View
            style={[
              styles.bottomContainer,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 20,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                setFeatureName("");
                setFeatureType("numeric");
                setEditingFeatureId(null);
                setModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.createButtonText}>创建特性</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 创建/编辑特性 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {editingFeatureId ? "编辑特性" : "创建新特性"}
              </ThemedText>

              <TextInput
                style={styles.textInput}
                placeholder="请输入特性名称"
                value={featureName}
                onChangeText={setFeatureName}
                autoFocus={true}
              />

              <View style={styles.identifierContainer}>
                <ThemedText style={styles.identifierLabel}>类型：</ThemedText>
                <View style={styles.radioGroup}>
                  <Pressable
                    style={[
                      styles.radioOption,
                      featureType === "numeric" && styles.radioOptionActive,
                    ]}
                    onPress={() => setFeatureType("numeric")}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        featureType === "numeric" && styles.radioCircleActive,
                      ]}
                    >
                      {featureType === "numeric" && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.radioLabel,
                        featureType === "numeric" && styles.radioLabelActive,
                      ]}
                    >
                      数值
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.radioOption,
                      featureType === "single_choice" &&
                        styles.radioOptionActive,
                    ]}
                    onPress={() => setFeatureType("single_choice")}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        featureType === "single_choice" &&
                          styles.radioCircleActive,
                      ]}
                    >
                      {featureType === "single_choice" && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.radioLabel,
                        featureType === "single_choice" &&
                          styles.radioLabelActive,
                      ]}
                    >
                      单选
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setFeatureName("");
                  setFeatureType("numeric");
                  setEditingFeatureId(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={
                  editingFeatureId ? handleUpdateFeature : handleCreateFeature
                }
              >
                <ThemedText style={styles.confirmButtonText}>
                  {editingFeatureId ? "保存" : "创建"}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
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
  featureItem: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureTitleContainer: {
    flex: 1,
  },
  featureName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    lineHeight: 24,
  },
  featureActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  iconButtonPressed: {
    opacity: 0.6,
    backgroundColor: "#E0E0E0",
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E0E0E0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  createButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    minHeight: 50,
    ...Platform.select({
      ios: {
        shadowColor: "#007AFF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    height: Dimensions.get("window").height * 0.85,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 24,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 24,
    color: "#000000",
    fontSize: 20,
    fontWeight: "600",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: "#FFFFFF",
    minHeight: 44,
  },
  identifierContainer: {
    marginBottom: 24,
  },
  identifierLabel: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 12,
    fontWeight: "500",
  },
  radioGroup: {
    flexDirection: "row",
    gap: 16,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    flex: 1,
  },
  radioOptionActive: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#999999",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: "#007AFF",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#007AFF",
  },
  radioLabel: {
    fontSize: 16,
    color: "#666666",
    fontWeight: "500",
  },
  radioLabelActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: "#F0F0F0",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
  },
  cancelButtonText: {
    color: "#666666",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  deleteModalTitle: {
    textAlign: "center",
    marginBottom: 16,
    color: "#000000",
    fontSize: 20,
    fontWeight: "600",
  },
  deleteModalMessage: {
    textAlign: "center",
    marginBottom: 24,
    color: "#666666",
    fontSize: 16,
    lineHeight: 22,
  },
  deleteConfirmButton: {
    backgroundColor: "#FF3B30",
  },
  deleteConfirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
