import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import { DataAdapter } from "@/utils/dataAdapter";
import { Collection } from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";

// 可拖拽排序的集合组件
const DraggableCollection = ({
  collection,
  index,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  draggedIndex,
  dragTranslationY,
  itemHeight,
  onPress,
  onEdit,
  onDelete,
}: {
  collection: Collection;
  index: number;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragUpdate: (fromIndex: number, translationY: number) => void;
  draggedIndex: number | null;
  dragTranslationY: number;
  itemHeight: number;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const translateY = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const isDragging = draggedIndex === index;
  const totalItemHeight = itemHeight + 12; // item高度 + marginBottom

  // 当拖拽位置变化时，更新其他项的偏移
  // 只移动相邻的元素，其他元素不动
  React.useEffect(() => {
    if (draggedIndex !== null && draggedIndex !== index) {
      const targetIndex =
        Math.round(dragTranslationY / totalItemHeight) + draggedIndex;

      // 只处理相邻元素的交换
      if (draggedIndex < index) {
        // 被拖拽项在当前位置之前
        // 只有当目标位置 >= 当前项位置时，当前项才需要向上移动
        if (targetIndex >= index) {
          offsetY.value = withSpring(-totalItemHeight);
        } else {
          offsetY.value = withSpring(0);
        }
      } else if (draggedIndex > index) {
        // 被拖拽项在当前位置之后
        // 只有当目标位置 <= 当前项位置时，当前项才需要向下移动
        if (targetIndex <= index) {
          offsetY.value = withSpring(totalItemHeight);
        } else {
          offsetY.value = withSpring(0);
        }
      } else {
        offsetY.value = withSpring(0);
      }
    } else {
      offsetY.value = withSpring(0);
    }
  }, [draggedIndex, dragTranslationY, index, totalItemHeight]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      translateY.value = 0;
      offsetY.value = 0;
      opacity.value = 0.8;
      scale.value = 1.05;
      onDragStart(index);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      onDragUpdate(index, e.translationY);
    })
    .onEnd(() => {
      const targetIndex =
        Math.round(translateY.value / totalItemHeight) + index;
      translateY.value = withSpring(0);
      offsetY.value = withSpring(0);
      opacity.value = withSpring(1);
      scale.value = withSpring(1);
      onDragEnd(index, targetIndex);
    })
    .minDistance(5);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: isDragging ? translateY.value : offsetY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
      zIndex: isDragging ? 1000 : 1,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.sortableCollectionItem, animatedStyle]}>
        <MaterialIcons name="drag-handle" size={24} color="#999999" />
        <ThemedText style={styles.sortableCollectionName}>
          {collection.name}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dataManager, data, loading, updateData, exportData, importData } =
    useUnifiedData();
  const adapterRef = React.useRef<DataAdapter | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = new DataAdapter(dataManager);
  }
  const adapter = adapterRef.current;

  const [modalVisible, setModalVisible] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null
  );
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
    null
  );
  const [importExportModalVisible, setImportExportModalVisible] =
    useState(false);
  const [importText, setImportText] = useState("");
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [draggedCollectionIndex, setDraggedCollectionIndex] = useState<
    number | null
  >(null);
  const [dragTranslationY, setDragTranslationY] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [collectionNameError, setCollectionNameError] = useState("");

  // 同步数据到集合列表
  useEffect(() => {
    if (!loading && data) {
      const adapterCollections = adapter.getCollections();
      // 使用深度比较，避免不必要的更新
      const collectionsJson = JSON.stringify(collections);
      const adapterCollectionsJson = JSON.stringify(adapterCollections);
      if (collectionsJson !== adapterCollectionsJson) {
        setCollections(adapterCollections);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  const handleCreateCollection = async () => {
    if (collectionName.trim()) {
      // 检查名称是否重复
      const trimmedName = collectionName.trim();
      const existingCollections = adapter.getCollections();
      const isDuplicate = existingCollections.some(
        (c) =>
          c.name === trimmedName &&
          (!editingCollectionId || c.id !== editingCollectionId)
      );

      if (isDuplicate) {
        setCollectionNameError("集合名称不能重复");
        return;
      }

      setCollectionNameError("");

      try {
        if (editingCollectionId) {
          // 编辑模式：更新集合名称
          const collectionIndex =
            dataManager.getCollectionIndexById(editingCollectionId);
          if (collectionIndex !== -1) {
            const collection = dataManager.getCollection(collectionIndex);
            if (collection) {
              dataManager.updateCollection(collectionIndex, {
                ...collection,
                name: trimmedName,
              });
              // 立即更新本地状态
              const adapterCollections = adapter.getCollections();
              setCollections(adapterCollections);
              // 异步保存数据
              updateData().catch((error) => {
                console.error("保存数据失败:", error);
              });
            }
          }
          setEditingCollectionId(null);
        } else {
          // 创建模式：创建新集合（空集合）
          const collectionId = Date.now().toString();
          const newCollection = {
            id: collectionId,
            name: trimmedName,
            createdAt: Date.now(),
            levels: [],
          };
          dataManager.addCollection(newCollection);
          await updateData();
        }
        setCollectionName("");
        setCollectionNameError("");
        setModalVisible(false);
      } catch (error) {
        console.error("操作失败:", error);
        Alert.alert("错误", "操作失败，请重试");
      }
    } else {
      setCollectionNameError("请输入集合名称");
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

  const confirmDelete = async () => {
    if (!collectionToDelete) return;

    try {
      const collectionIndex =
        dataManager.getCollectionIndexById(collectionToDelete);
      if (collectionIndex !== -1) {
        dataManager.removeCollection(collectionIndex);
        // 立即更新本地状态
        const adapterCollections = adapter.getCollections();
        setCollections(adapterCollections);
        // 异步保存数据
        updateData().catch((error) => {
          console.error("保存数据失败:", error);
        });
      }
      setDeleteConfirmVisible(false);
      setCollectionToDelete(null);
    } catch (error) {
      console.error("删除失败:", error);
      Alert.alert("错误", "删除失败，请重试");
    }
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
    setCollectionNameError("");
    setEditingCollectionId(null);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setCollectionName("");
    setCollectionNameError("");
    setEditingCollectionId(null);
  };

  const handleExport = () => {
    const success = exportData();
    if (success) {
      Alert.alert("成功", "数据已复制到剪贴板");
      setImportExportModalVisible(false);
    } else {
      Alert.alert("错误", "导出失败，请重试");
    }
  };

  const handleImport = async () => {
    if (importText.trim()) {
      try {
        const success = await dataManager.importFromJSON(importText.trim());
        if (success) {
          await updateData();
          Alert.alert("成功", "数据导入成功");
          setImportText("");
          setImportExportModalVisible(false);
        } else {
          Alert.alert("错误", "数据格式不正确");
        }
      } catch (error) {
        console.error("导入失败:", error);
        Alert.alert("错误", "导入失败，请重试");
      }
    } else {
      Alert.alert("错误", "请输入JSON数据");
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const success = await importData();
      if (success) {
        Alert.alert("成功", "数据已从剪贴板导入");
        setImportExportModalVisible(false);
      } else {
        Alert.alert("错误", "剪贴板中没有有效数据");
      }
    } catch (error) {
      console.error("粘贴失败:", error);
      Alert.alert("错误", "粘贴失败，请重试");
    }
  };

  // 处理集合拖拽开始
  const handleCollectionDragStart = (index: number) => {
    setDraggedCollectionIndex(index);
    setDragTranslationY(0);
  };

  // 处理集合拖拽更新
  const handleCollectionDragUpdate = useCallback(
    (fromIndex: number, translationY: number) => {
      setDragTranslationY(translationY);
    },
    []
  );

  // 处理集合拖拽结束
  const handleCollectionDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      setDraggedCollectionIndex(null);
      setDragTranslationY(0);
      const maxIndex = collections.length - 1;
      const validToIndex = Math.max(0, Math.min(toIndex, maxIndex));

      if (fromIndex !== validToIndex) {
        setCollections((prev) => {
          const newCollections = [...prev];
          const [movedCollection] = newCollections.splice(fromIndex, 1);
          newCollections.splice(validToIndex, 0, movedCollection);

          // 更新dataManager中的集合顺序
          const currentData = dataManager.getData();
          const reorderedCollections = newCollections.map(
            (c) => currentData.collections.find((ac) => ac.id === c.id) || c
          );

          // 直接更新集合数组
          dataManager.setData({
            ...currentData,
            collections: reorderedCollections,
          });

          // 异步保存
          updateData().catch((error) => {
            console.error("保存数据失败:", error);
          });

          return newCollections;
        });
      }
    },
    [collections, dataManager, updateData]
  );

  // 退出排序模式
  const handleExitSortingMode = () => {
    setIsSortingMode(false);
    setDraggedCollectionIndex(null);
    setDragTranslationY(0);
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
          headerLeft: () => null,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable
                style={styles.headerButton}
                onPress={() => {
                  router.push("/debug");
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                android_ripple={{ color: "#007AFF20" }}
              >
                <MaterialIcons name="bug-report" size={24} color="#FF9500" />
              </Pressable>
              <Pressable
                style={styles.headerButton}
                onPress={() => {
                  router.push("/features");
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                android_ripple={{ color: "#007AFF20" }}
              >
                <MaterialIcons name="tune" size={24} color="#007AFF" />
              </Pressable>
              {!isSortingMode && (
                <Pressable
                  style={styles.headerButton}
                  onPress={() => setShowMoreMenu(!showMoreMenu)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  android_ripple={{ color: "#007AFF20" }}
                >
                  <MaterialIcons
                    name="more-vert"
                    size={24}
                    color={showMoreMenu ? "#0051D5" : "#007AFF"}
                  />
                </Pressable>
              )}
              {isSortingMode && (
                <Pressable
                  style={[styles.headerButton, styles.headerButtonActive]}
                  onPress={() => setIsSortingMode(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  android_ripple={{ color: "#007AFF20" }}
                >
                  <MaterialIcons name="sort" size={24} color="#0051D5" />
                </Pressable>
              )}
            </View>
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
          {/* 更多菜单下拉面板 */}
          {showMoreMenu && !isSortingMode && (
            <>
              <Pressable
                style={styles.dropdownOverlay}
                onPress={() => setShowMoreMenu(false)}
              />
              <View style={[styles.dropdownMenuContainer, { top: insets.top }]}>
                <Pressable
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    setShowMoreMenu(false);
                    setIsSortingMode(true);
                  }}
                >
                  <MaterialIcons name="sort" size={20} color="#007AFF" />
                  <ThemedText style={styles.dropdownMenuItemText}>
                    排序
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    setShowMoreMenu(false);
                    setImportExportModalVisible(true);
                  }}
                >
                  <MaterialIcons
                    name="import-export"
                    size={20}
                    color="#007AFF"
                  />
                  <ThemedText style={styles.dropdownMenuItemText}>
                    导出
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              {
                paddingBottom: isSortingMode
                  ? insets.bottom + 80
                  : insets.bottom + 100,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {collections.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  暂无集合，点击下方按钮创建第一个集合
                </ThemedText>
              </ThemedView>
            ) : isSortingMode ? (
              collections.map((collection, index) => (
                <DraggableCollection
                  key={collection.id}
                  collection={collection}
                  index={index}
                  onDragStart={handleCollectionDragStart}
                  onDragEnd={handleCollectionDragEnd}
                  onDragUpdate={handleCollectionDragUpdate}
                  draggedIndex={draggedCollectionIndex}
                  dragTranslationY={dragTranslationY}
                  itemHeight={80}
                  onPress={() => handleCollectionPress(collection)}
                  onEdit={() => handleEditCollection(collection)}
                  onDelete={() => handleDeleteCollection(collection.id)}
                />
              ))
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

          {/* 完成排序按钮（固定在底部） */}
          {isSortingMode && (
            <View
              style={[
                styles.exitSortingButtonContainer,
                { paddingBottom: insets.bottom + 16 },
              ]}
            >
              <TouchableOpacity
                style={styles.exitSortingButton}
                onPress={handleExitSortingMode}
              >
                <ThemedText style={styles.exitSortingButtonText}>
                  完成排序
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {!isSortingMode && (
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
                <ThemedText style={styles.createButtonText}>
                  创建集合
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
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
              style={[
                styles.textInput,
                collectionNameError && styles.textInputError,
              ]}
              placeholder="请输入集合名称"
              value={collectionName}
              onChangeText={(text) => {
                setCollectionName(text);
                // 清除错误提示
                if (collectionNameError) {
                  setCollectionNameError("");
                }
              }}
              autoFocus={true}
            />
            {collectionNameError ? (
              <ThemedText style={styles.errorText}>
                {collectionNameError}
              </ThemedText>
            ) : null}

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

      {/* 导入导出 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={importExportModalVisible}
        onRequestClose={() => setImportExportModalVisible(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              导入/导出数据
            </ThemedText>

            <ThemedView style={styles.importExportButtons}>
              <TouchableOpacity
                style={[styles.button, styles.exportButton]}
                onPress={handleExport}
              >
                <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
                <ThemedText style={styles.exportButtonText}>
                  导出到剪贴板
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.importButton]}
                onPress={handlePasteFromClipboard}
              >
                <MaterialIcons name="content-paste" size={20} color="#FFFFFF" />
                <ThemedText style={styles.importButtonText}>
                  从剪贴板导入
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.importLabel}>或手动粘贴JSON：</ThemedText>
            <TextInput
              style={styles.textArea}
              placeholder="粘贴JSON数据..."
              value={importText}
              onChangeText={setImportText}
              multiline={true}
              numberOfLines={10}
              textAlignVertical="top"
            />

            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setImportExportModalVisible(false);
                  setImportText("");
                }}
              >
                <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleImport}
              >
                <ThemedText style={styles.confirmButtonText}>导入</ThemedText>
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
  sortableCollectionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
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
  sortableCollectionName: {
    flex: 1,
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButtonActive: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
  },
  exitSortingButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
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
  exitSortingButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#007AFF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  exitSortingButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 998,
  },
  dropdownMenuContainer: {
    position: "absolute",
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    minWidth: 120,
    paddingVertical: 8,
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dropdownMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownMenuItemText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
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
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    minHeight: 44, // 移动端最小触摸区域
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
  importExportButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  exportButton: {
    flex: 1,
    backgroundColor: "#34C759",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  importButton: {
    flex: 1,
    backgroundColor: "#FF9500",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  importButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  importLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 24,
    backgroundColor: "#FFFFFF",
    minHeight: 200,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
