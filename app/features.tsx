import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useUnifiedData } from "@/hooks/useUnifiedData";
import { DataAdapter } from "@/utils/dataAdapter";
import { Feature } from "@/utils/storage";

export default function FeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    dataManager,
    data,
    loading: dataLoading,
    updateData,
  } = useUnifiedData();
  const adapterRef = React.useRef<DataAdapter | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = new DataAdapter(dataManager);
  }
  const adapter = adapterRef.current;

  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [featureName, setFeatureName] = useState("");
  const [featureType, setFeatureType] = useState<"numeric" | "single_choice">(
    "numeric"
  );
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [featureNameError, setFeatureNameError] = useState("");

  // 加载特性列表
  useEffect(() => {
    if (!dataLoading) {
      try {
        // 使用适配器加载全局特性
        const allFeatures = adapter.getFeaturesByCollectionId("global");
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
    }
  }, [dataLoading, adapter]);

  // 使用 ref 跟踪是否正在更新，避免无限循环
  const isUpdatingRef = React.useRef(false);
  const lastSyncFeaturesRef = React.useRef<string>("");

  // 同步特性数据到统一数据结构
  useEffect(() => {
    if (!loading && !dataLoading && !isUpdatingRef.current) {
      // 创建当前状态的快照用于比较
      const currentFeaturesSnapshot = JSON.stringify(features);

      // 如果数据没有变化，跳过同步
      if (currentFeaturesSnapshot === lastSyncFeaturesRef.current) {
        return;
      }

      isUpdatingRef.current = true;
      lastSyncFeaturesRef.current = currentFeaturesSnapshot;

      try {
        // 更新所有特性到统一数据结构
        features.forEach((feature) => {
          if (feature.collectionId === "global") {
            const existingFeature = dataManager.getFeature(feature.id);
            if (!existingFeature) {
              dataManager.addFeature({
                id: feature.id,
                name: feature.name,
                type: feature.type,
                createdAt: feature.createdAt,
              });
            } else {
              dataManager.updateFeature(feature.id, {
                id: feature.id,
                name: feature.name,
                type: feature.type,
                createdAt: feature.createdAt,
              });
            }
          }
        });

        // 保存数据（异步执行，避免阻塞）
        updateData()
          .catch((error) => {
            console.error("保存特性数据失败:", error);
          })
          .finally(() => {
            // 延迟重置标志，避免立即触发新的同步
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 100);
          });
      } catch (error) {
        console.error("同步特性数据失败:", error);
        isUpdatingRef.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, loading, dataLoading]);

  const handleCreateFeature = async () => {
    if (featureName.trim()) {
      const trimmedName = featureName.trim();

      // 检查名称是否重复
      const isDuplicate = features.some(
        (f) =>
          f.name === trimmedName &&
          (!editingFeatureId || f.id !== editingFeatureId)
      );

      if (isDuplicate) {
        setFeatureNameError("特性名称不能重复");
        return;
      }

      setFeatureNameError("");

      try {
        const newFeature: Feature = {
          id: Date.now().toString(),
          collectionId: "global", // 全局特性
          name: trimmedName,
          type: featureType,
          createdAt: Date.now(),
        };
        setFeatures((prev) => [...prev, newFeature]);
        setFeatureName("");
        setFeatureNameError("");
        setFeatureType("numeric");
        setEditingFeatureId(null);
        setModalVisible(false);
      } catch (error) {
        console.error("创建特性失败:", error);
        Alert.alert("错误", "创建特性失败，请重试");
      }
    } else {
      setFeatureNameError("请输入特性名称");
    }
  };

  const handleEditFeature = (feature: Feature) => {
    setFeatureName(feature.name);
    setFeatureNameError("");
    setFeatureType(feature.type);
    setEditingFeatureId(feature.id);
    setModalVisible(true);
  };

  const handleUpdateFeature = () => {
    if (featureName.trim() && editingFeatureId) {
      const trimmedName = featureName.trim();

      // 检查名称是否重复
      const isDuplicate = features.some(
        (f) => f.name === trimmedName && f.id !== editingFeatureId
      );

      if (isDuplicate) {
        setFeatureNameError("特性名称不能重复");
        return;
      }

      setFeatureNameError("");

      setFeatures((prev) =>
        prev.map((feature) =>
          feature.id === editingFeatureId
            ? {
                ...feature,
                collectionId: "global", // 确保更新后仍然是全局特性
                name: trimmedName,
                type: featureType,
              }
            : feature
        )
      );
      setFeatureName("");
      setFeatureNameError("");
      setFeatureType("numeric");
      setEditingFeatureId(null);
      setModalVisible(false);
    } else {
      setFeatureNameError("请输入特性名称");
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    try {
      // 使用统一数据管理器删除特性（会自动清理所有引用）
      dataManager.removeFeature(featureId);
      // 更新本地状态
      setFeatures((prev) => prev.filter((item) => item.id !== featureId));
      // 保存数据
      await updateData();
    } catch (error) {
      console.error("删除特性失败:", error);
      Alert.alert("错误", "删除特性失败，请重试");
    }
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
                style={[
                  styles.textInput,
                  featureNameError && styles.textInputError,
                ]}
                placeholder="请输入特性名称"
                value={featureName}
                onChangeText={(text) => {
                  setFeatureName(text);
                  // 清除错误提示
                  if (featureNameError) {
                    setFeatureNameError("");
                  }
                }}
                autoFocus={true}
              />
              {featureNameError ? (
                <ThemedText style={styles.errorText}>
                  {featureNameError}
                </ThemedText>
              ) : null}

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
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    minHeight: 44,
  },
  textInputError: {
    borderColor: "#FF3B30",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    marginBottom: 16,
    marginTop: -8,
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
