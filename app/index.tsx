import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { Collection, loadCollections, saveCollections } from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null
  );
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
    null
  );

  // 加载数据
  useEffect(() => {
    const initData = async () => {
      try {
        const loadedCollections = await loadCollections();
        setCollections(loadedCollections);
      } catch (error) {
        console.error("加载数据失败:", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // 保存数据
  useEffect(() => {
    if (!loading && collections.length >= 0) {
      saveCollections(collections).catch((error) => {
        console.error("保存数据失败:", error);
      });
    }
  }, [collections, loading]);

  const handleCreateCollection = () => {
    if (collectionName.trim()) {
      if (editingCollectionId) {
        // 编辑模式
        setCollections((prev) =>
          prev.map((item) =>
            item.id === editingCollectionId
              ? { ...item, name: collectionName.trim() }
              : item
          )
        );
        setEditingCollectionId(null);
      } else {
        // 创建模式
        const newCollection: Collection = {
          id: Date.now().toString(),
          name: collectionName.trim(),
          createdAt: Date.now(),
        };
        setCollections((prev) => [...prev, newCollection]);
      }
      setCollectionName("");
      setModalVisible(false);
    } else {
      Alert.alert("错误", "请输入集合名称");
    }
  };

  const handleEditCollection = (collection: Collection) => {
    setCollectionName(collection.name);
    setEditingCollectionId(collection.id);
    setModalVisible(true);
  };

  const handleDeleteCollection = (collectionId: string) => {
    setCollectionToDelete(collectionId);
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = () => {
    if (!collectionToDelete) return;

    // 使用函数式更新，确保使用最新的状态
    setCollections((prevCollections) => {
      const updatedCollections = prevCollections.filter((item) => {
        return item.id !== collectionToDelete;
      });
      // useEffect 会自动保存 updatedCollections
      return updatedCollections;
    });

    setDeleteConfirmVisible(false);
    setCollectionToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmVisible(false);
    setCollectionToDelete(null);
  };

  const handleCollectionPress = (collection: Collection) => {
    router.push({
      pathname: `/collection/${collection.id}`,
      params: {
        name: collection.name,
        createdAt: collection.createdAt.toString(),
      },
    });
  };

  const handleOpenCreateModal = () => {
    setCollectionName("");
    setEditingCollectionId(null);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setCollectionName("");
    setEditingCollectionId(null);
  };

  // Stack.Screen 必须在组件顶层，确保始终渲染
  // 使用 key 确保每次渲染时都更新配置
  return (
    <>
      <Stack.Screen
        key="home-screen"
        options={{
          title: "集合",
          headerShown: true,
          headerBackVisible: false,
          headerRight: () => (
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                router.push("/features");
              }}
            >
              <MaterialIcons name="tune" size={24} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ThemedView style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>加载中...</ThemedText>
          </ThemedView>
        </View>
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
            {collections.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  暂无集合，点击下方按钮创建第一个集合
                </ThemedText>
              </ThemedView>
            ) : (
              collections.map((collection) => (
                <View key={collection.id} style={styles.collectionItem}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.collectionContent,
                      pressed && styles.collectionContentPressed,
                    ]}
                    onPress={() => handleCollectionPress(collection)}
                  >
                    <ThemedText style={styles.collectionName}>
                      {collection.name}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.collectionActions}
                    onPress={() => handleCollectionPress(collection)}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.iconButtonPressed,
                      ]}
                      onPress={() => {
                        handleEditCollection(collection);
                      }}
                    >
                      <MaterialIcons name="edit" size={20} color="#007AFF" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.iconButtonPressed,
                      ]}
                      onPress={() => {
                        handleDeleteCollection(collection.id);
                      }}
                    >
                      <MaterialIcons name="delete" size={20} color="#FF3B30" />
                    </Pressable>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          <View
            style={[
              styles.bottomContainerWrapper,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 20,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleOpenCreateModal}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.createButtonText}>创建集合</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {editingCollectionId ? "编辑集合" : "创建新集合"}
            </ThemedText>

            <TextInput
              style={styles.textInput}
              placeholder="请输入集合名称"
              value={collectionName}
              onChangeText={setCollectionName}
              autoFocus={true}
            />

            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCloseModal}
              >
                <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleCreateCollection}
              >
                <ThemedText style={styles.confirmButtonText}>
                  {editingCollectionId ? "保存" : "创建"}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteConfirmVisible}
        onRequestClose={cancelDelete}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.deleteModalContent}>
            <ThemedText type="subtitle" style={styles.deleteModalTitle}>
              确认删除
            </ThemedText>
            <ThemedText style={styles.deleteModalMessage}>
              确定要删除这个集合吗？此操作不可恢复。
            </ThemedText>

            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.deleteConfirmButton]}
                onPress={confirmDelete}
              >
                <ThemedText style={styles.deleteConfirmButtonText}>
                  删除
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#999999",
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
  collectionItem: {
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
  collectionContent: {
    flex: 1,
    marginBottom: 12,
    paddingVertical: 4,
  },
  collectionContentPressed: {
    opacity: 0.7,
  },
  collectionName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    lineHeight: 24,
  },
  collectionActions: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
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
  bottomContainerWrapper: {
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
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    minHeight: 50, // 移动端最小触摸区域
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
    minHeight: 44, // 移动端最小触摸区域
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 44, // 移动端最小触摸区域
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
});
