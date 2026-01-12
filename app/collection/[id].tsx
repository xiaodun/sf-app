import { logDebug, logError, logInfo } from "@/utils/debugLogger";
import * as Haptics from "expo-haptics";
import {
    Stack,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import {
    FavoriteUnit,
    Feature,
    Level,
    RecommendedUnit,
    TrashedUnit,
    Unit,
    UnitFeature,
} from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";

interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

// 可拖拽单元组件
const DraggableUnit = ({
  unit,
  levelId,
  levelName,
  onMoveToRecommend,
  onMoveToTrash,
  onDoublePress,
}: {
  unit: Unit;
  levelId: string;
  levelName: string;
  onMoveToRecommend: () => void;
  onMoveToTrash: () => void;
  onDoublePress: () => void;
}) => {
  const translateY = useSharedValue(0);
  const DRAG_THRESHOLD = 30; // 拖拽阈值

  const panGesture = Gesture.Pan()
    .onStart(() => {
      logDebug("Gesture", `拖动手势开始 - 单元: ${unit.name}`, {
        unitId: unit.id,
        levelId,
        levelName,
      });
      translateY.value = 0;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      logDebug("Gesture", `拖动手势更新 - 单元: ${unit.name}`, {
        translationY: e.translationY,
        velocityY: e.velocityY,
      });
    })
    .onEnd((e) => {
      const translationY = e.translationY;
      logInfo("Gesture", `拖动手势结束 - 单元: ${unit.name}`, {
        translationY,
        velocityY: e.velocityY,
        threshold: DRAG_THRESHOLD,
      });
      
      try {
        if (translationY < -DRAG_THRESHOLD) {
          // 向上拖动，进入推荐
          logInfo("Gesture", `向上拖动到推荐 - 单元: ${unit.name}`);
          onMoveToRecommend();
        } else if (translationY > DRAG_THRESHOLD) {
          // 向下拖动，进入回收站
          logInfo("Gesture", `向下拖动到回收站 - 单元: ${unit.name}`);
          onMoveToTrash();
        } else {
          logDebug("Gesture", `拖动距离不足，取消操作 - 单元: ${unit.name}`, {
            translationY,
            threshold: DRAG_THRESHOLD,
          });
        }
        translateY.value = withSpring(0);
      } catch (error) {
        logError("Gesture", "拖动处理失败", { unitId: unit.id, translationY }, error as Error);
      }
    })
    .onFinalize(() => {
      logDebug("Gesture", `拖动手势结束 - 单元: ${unit.name}`);
    })
    .minDistance(10);

  // 添加双击手势
  const tapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      logInfo("Gesture", `双击单元 - 单元: ${unit.name}`, {
        unitId: unit.id,
        levelId,
        levelName,
      });
      try {
        onDoublePress();
      } catch (error) {
        logError("Gesture", "双击处理失败", { unitId: unit.id }, error as Error);
      }
    });

  // 同时处理拖动和双击手势
  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.unitItem, animatedStyle]}>
        <ThemedText style={styles.unitName}>{unit.name}</ThemedText>
      </Animated.View>
    </GestureDetector>
  );
};

// 可拖拽排序的层次组件
const DraggableLevel = ({
  level,
  index,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  draggedIndex,
  dragTranslationY,
  itemHeight,
}: {
  level: Level;
  index: number;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragUpdate: (fromIndex: number, translationY: number) => void;
  draggedIndex: number | null;
  dragTranslationY: number;
  itemHeight: number;
}) => {
  const translateY = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const isDragging = draggedIndex === index;
  const totalItemHeight = itemHeight + 12; // item高度 + marginBottom

  // 当拖拽位置变化时，更新其他项的偏移
  // 只移动相邻的元素，其他元素不动
  // 例如：1 2 3，拖动1向下
  // - 当1的目标位置 >= 2的位置时，2需要向上移动到1的位置
  // - 当1的目标位置 < 2的位置时，2不需要移动
  React.useEffect(() => {
    if (draggedIndex !== null && draggedIndex !== index) {
      const targetIndex =
        Math.round(dragTranslationY / totalItemHeight) + draggedIndex;

      // 只处理相邻元素的交换
      if (draggedIndex < index) {
        // 被拖拽项在当前位置之前（向下拖动）
        // 只有当目标位置 >= 当前项位置时，当前项才需要向上移动
        if (targetIndex >= index) {
          offsetY.value = withSpring(-totalItemHeight);
        } else {
          offsetY.value = withSpring(0);
        }
      } else if (draggedIndex > index) {
        // 被拖拽项在当前位置之后（向上拖动）
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
  }, [draggedIndex, dragTranslationY, index, totalItemHeight, offsetY]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      logInfo("LevelSort", `层级拖拽开始 - ${level.name}`, {
        levelId: level.id,
        index,
      });
      translateY.value = 0;
      offsetY.value = 0;
      opacity.value = 0.8;
      scale.value = 1.05;
      try {
        onDragStart(index);
      } catch (error) {
        logError("LevelSort", "拖拽开始处理失败", { levelId: level.id, index }, error as Error);
      }
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      logDebug("LevelSort", `层级拖拽更新 - ${level.name}`, {
        translationY: e.translationY,
        velocityY: e.velocityY,
      });
      try {
        onDragUpdate(index, e.translationY);
      } catch (error) {
        logError("LevelSort", "拖拽更新处理失败", { levelId: level.id, index }, error as Error);
      }
    })
    .onEnd(() => {
      // 计算目标位置
      const targetIndex =
        Math.round(translateY.value / totalItemHeight) + index;
      logInfo("LevelSort", `层级拖拽结束 - ${level.name}`, {
        fromIndex: index,
        toIndex: targetIndex,
        translationY: translateY.value,
        totalItemHeight,
      });
      translateY.value = withSpring(0);
      offsetY.value = withSpring(0);
      opacity.value = withSpring(1);
      scale.value = withSpring(1);
      try {
        onDragEnd(index, targetIndex);
      } catch (error) {
        logError("LevelSort", "拖拽结束处理失败", { levelId: level.id, index, targetIndex }, error as Error);
      }
    })
    .onFinalize(() => {
      logDebug("LevelSort", `层级拖拽完成 - ${level.name}`);
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
      <Animated.View style={[styles.sortableLevelItem, animatedStyle]}>
        <MaterialIcons name="drag-handle" size={24} color="#999999" />
        <ThemedText style={styles.sortableLevelName}>{level.name}</ThemedText>
      </Animated.View>
    </GestureDetector>
  );
};

export default function CollectionDetailScreen() {
  const { id, name, createdAt } = useLocalSearchParams<{
    id: string;
    name: string;
    createdAt: string;
  }>();
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

  const [collection, setCollection] = useState<Collection | null>(null);
  const [activeTab, setActiveTab] = useState<"level" | "recommend">("level");
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const [tabContainerHeight, setTabContainerHeight] = useState(0);
  const [levels, setLevels] = useState<Level[]>([]);
  const [recommendedUnits, setRecommendedUnits] = useState<RecommendedUnit[]>(
    []
  );
  // 回收站数据，用于拖拽功能，实际显示在单独的回收站页面
  const [trashedUnits, setTrashedUnits] = useState<TrashedUnit[]>([]);
  // 使用 ref 存储最新状态，避免嵌套 setState 导致的状态读取问题
  const recommendedUnitsRef = React.useRef<RecommendedUnit[]>([]);
  const trashedUnitsRef = React.useRef<TrashedUnit[]>([]);
  const [favoriteUnits, setFavoriteUnits] = useState<FavoriteUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [levelName, setLevelName] = useState("");
  const [identifierType, setIdentifierType] = useState<"numeric" | "alpha">(
    "numeric"
  );
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [modalUnits, setModalUnits] = useState<Unit[]>([]);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<string | null>(null);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [refreshButtonPressed, setRefreshButtonPressed] = useState(false);
  const [numericPickerVisible, setNumericPickerVisible] = useState(false);
  const [favoriteReasonModalVisible, setFavoriteReasonModalVisible] =
    useState(false);
  const [currentUnitForFavorite, setCurrentUnitForFavorite] = useState<{
    unit: Unit;
    levelName: string;
    levelId: string;
  } | null>(null);
  const [favoriteReason, setFavoriteReason] = useState("");
  const [currentFeatureForPicker, setCurrentFeatureForPicker] =
    useState<Feature | null>(null);
  const [unitFeatures, setUnitFeatures] = useState<UnitFeature[]>([]);
  const [editingUnitName, setEditingUnitName] = useState<string>("");
  const [unitNameError, setUnitNameError] = useState<string>("");
  const [levelNameError, setLevelNameError] = useState("");
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [draggedLevelIndex, setDraggedLevelIndex] = useState<number | null>(
    null
  );

  // 加载集合信息
  useEffect(() => {
    if (id && name && createdAt) {
      setCollection({
        id: id,
        name: name,
        createdAt: parseInt(createdAt, 10),
      });
    }
  }, [id, name, createdAt]);

  // 加载数据的函数
  const loadData = useCallback(async () => {
    if (id && !dataLoading) {
      setLoading(true);
      try {
        // 使用适配器加载数据
        const loadedLevels = adapter.getLevelsByCollectionId(id);
        const allFeatures = adapter.getFeaturesByCollectionId(id);
        const loadedUnitFeatures = adapter.getUnitFeatures();
        const loadedRecommendedUnits = adapter.getRecommendedUnits(id);
        const loadedTrashedUnits = adapter.getTrashedUnits(id);
        const loadedFavoriteUnits = adapter.getFavoriteUnits(id);

        setLevels(loadedLevels);
        // 只使用全局特性（collectionId 为 "global"），并去重
        const globalFeatures = allFeatures.filter(
          (f) => f.collectionId === "global"
        );
        // 根据 id 去重
        const uniqueFeatures = Array.from(
          new Map(globalFeatures.map((f) => [f.id, f])).values()
        );
        setFeatures(uniqueFeatures);
        setUnitFeatures(loadedUnitFeatures);
        setRecommendedUnits(loadedRecommendedUnits);
        setTrashedUnits(loadedTrashedUnits);
        setFavoriteUnits(loadedFavoriteUnits);
      } catch (error) {
        console.error("加载数据失败:", error);
      } finally {
        setLoading(false);
      }
    }
  }, [id, dataLoading, adapter]);

  // 加载层级列表和特性
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 当页面获得焦点时重新加载数据（从其他页面返回时）
  useFocusEffect(
    useCallback(() => {
      // 重新加载所有数据，确保数据是最新的
      if (id) {
        loadData();
      }
    }, [id, loadData])
  );

  // 同步 ref 和 state，确保 ref 始终是最新值
  useEffect(() => {
    recommendedUnitsRef.current = recommendedUnits;
  }, [recommendedUnits]);

  useEffect(() => {
    trashedUnitsRef.current = trashedUnits;
  }, [trashedUnits]);

  // 刷新按钮处理函数，使用 useCallback 避免每次渲染都创建新函数
  const handleRefreshPress = useCallback(() => {
    // 立即设置按钮按下状态，提供视觉反馈
    setRefreshButtonPressed(true);
    setTimeout(() => {
      setRefreshButtonPressed(false);
    }, 200);

    // 立即添加触觉反馈，确保用户知道按钮被点击了
    try {
      if (Platform.OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (Platform.OS === "android") {
        // Android 也可以使用触觉反馈
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // 触觉反馈失败，静默处理
    }

    // 使用 setTimeout 确保状态更新在下一个事件循环中执行
    setTimeout(() => {
      setResetConfirmVisible(true);
    }, 0);
  }, []);

  // 使用 ref 跟踪是否正在更新，避免无限循环
  const isUpdatingRef = React.useRef(false);
  const lastSyncDataRef = React.useRef<string>("");

  // 同步数据到统一数据结构
  useEffect(() => {
    if (!loading && !dataLoading && id && !isUpdatingRef.current) {
      const collectionIndex = dataManager.getCollectionIndexById(id);
      if (collectionIndex === -1) return;

      // 创建当前状态的快照用于比较
      const currentStateSnapshot = JSON.stringify({
        levels,
        features,
        unitFeatures,
        recommendedUnits,
        trashedUnits,
        favoriteUnits,
      });

      // 如果数据没有变化，跳过同步
      if (currentStateSnapshot === lastSyncDataRef.current) {
        return;
      }

      isUpdatingRef.current = true;
      lastSyncDataRef.current = currentStateSnapshot;

      try {
        // 将levels转换为新数据结构中的层次
        const newLevels = levels.map((level) => {
          // 获取该层次的所有单元（包括推荐、回收站、收藏的）
          const levelUnits = level.units.map((unit) => {
            // 查找单元的特性值
            const unitFeatureValues = unitFeatures
              .filter((uf) => uf.unitId === unit.id)
              .map((uf) => ({
                featureId: uf.featureId,
                value: uf.value,
              }));

            // 确定单元状态
            let status: "normal" | "recommended" | "favorite" | "trash" =
              "normal";
            let favoriteReason: string | undefined;
            let favoriteCreatedAt: number | undefined;

            const favoriteUnit = favoriteUnits.find(
              (fu) => fu.unit.id === unit.id && fu.levelId === level.id
            );
            const recommendedUnit = recommendedUnits.find(
              (ru) => ru.unit.id === unit.id && ru.levelId === level.id
            );
            const trashedUnit = trashedUnits.find(
              (tu) => tu.unit.id === unit.id && tu.levelId === level.id
            );

            if (favoriteUnit) {
              status = "favorite";
              favoriteReason = favoriteUnit.reason;
              favoriteCreatedAt = favoriteUnit.createdAt;
            } else if (recommendedUnit) {
              status = "recommended";
            } else if (trashedUnit) {
              status = "trash";
            }

            return {
              id: unit.id,
              name: unit.name,
              status,
              features: unitFeatureValues,
              ...(favoriteReason && { favoriteReason }),
              ...(favoriteCreatedAt && { favoriteCreatedAt }),
            };
          });

          return {
            id: level.id,
            name: level.name,
            identifier: level.identifier,
            units: levelUnits,
            createdAt: level.createdAt,
          };
        });

        // 更新集合（保留集合元数据，只更新层次）
        const collection = dataManager.getCollection(collectionIndex);
        if (collection) {
          dataManager.updateCollection(collectionIndex, {
            ...collection,
            levels: newLevels,
          });
        }

        // 更新特性（只更新全局特性）
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
            console.error("保存数据失败:", error);
          })
          .finally(() => {
            // 延迟重置标志，避免立即触发新的同步
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 100);
          });
      } catch (error) {
        console.error("同步数据失败:", error);
        isUpdatingRef.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    levels,
    features,
    unitFeatures,
    recommendedUnits,
    trashedUnits,
    favoriteUnits,
    loading,
    dataLoading,
    id,
  ]);

  const handleCreateLevel = () => {
    if (levelName.trim() && id) {
      const trimmedName = levelName.trim();

      // 检查名称是否重复
      const isDuplicate = levels.some((l) => l.name === trimmedName);

      if (isDuplicate) {
        setLevelNameError("层级名称不能重复");
        return;
      }

      setLevelNameError("");

      const newLevel: Level = {
        id: Date.now().toString(),
        collectionId: id,
        name: trimmedName,
        identifier: identifierType,
        units: modalUnits,
        createdAt: Date.now(),
      };
      setLevels((prev) => [...prev, newLevel]);
      setLevelName("");
      setLevelNameError("");
      setIdentifierType("numeric");
      setModalUnits([]);
      setEditingLevelId(null);
      setModalVisible(false);
    } else {
      setLevelNameError("请输入层级名称");
    }
  };

  const handleEditLevel = (level: Level) => {
    setLevelName(level.name);
    setLevelNameError("");
    setIdentifierType(level.identifier as "numeric" | "alpha");
    setModalUnits([...level.units]);
    setEditingLevelId(level.id);
    setModalVisible(true);
  };

  const handleUpdateLevel = () => {
    if (levelName.trim() && editingLevelId) {
      const trimmedName = levelName.trim();

      // 检查名称是否重复（排除当前编辑的层级）
      const isDuplicate = levels.some(
        (l) => l.name === trimmedName && l.id !== editingLevelId
      );

      if (isDuplicate) {
        setLevelNameError("层级名称不能重复");
        return;
      }

      setLevelNameError("");

      const oldLevel = levels.find((l) => l.id === editingLevelId);
      const oldUnitIds = oldLevel?.units.map((u) => u.id) || [];
      const newUnitIds = modalUnits.map((u) => u.id);

      // 找出被删除的单元（在旧列表中但不在新列表中）
      const deletedUnitIds = oldUnitIds.filter(
        (id) => !newUnitIds.includes(id)
      );

      // 将被删除的单元从推荐和回收站中移除，并放回对应的层级
      deletedUnitIds.forEach((unitId) => {
        // 从推荐列表中移除并放回层级
        const recommendedItem = recommendedUnits.find(
          (item) => item.unit.id === unitId && item.levelId === editingLevelId
        );
        if (recommendedItem) {
          setRecommendedUnits((prev) =>
            prev.filter((item) => item.unit.id !== unitId)
          );
          // 将单元放回层级
          const unit = oldLevel?.units.find((u) => u.id === unitId);
          if (unit && !modalUnits.some((u) => u.id === unitId)) {
            setModalUnits((prev) => [...prev, unit]);
          }
        }

        // 从回收站中移除并放回层级
        const trashedItem = trashedUnits.find(
          (item) => item.unit.id === unitId && item.levelId === editingLevelId
        );
        if (trashedItem) {
          setTrashedUnits((prev) =>
            prev.filter((item) => item.unit.id !== unitId)
          );
          // 将单元放回层级
          const unit = oldLevel?.units.find((u) => u.id === unitId);
          if (unit && !modalUnits.some((u) => u.id === unitId)) {
            setModalUnits((prev) => [...prev, unit]);
          }
        }
      });

      // 更新层级，同时清理推荐和回收站中已不存在的单元
      setLevels((prev) =>
        prev.map((level) =>
          level.id === editingLevelId
            ? {
                ...level,
                name: trimmedName,
                identifier: identifierType,
                units: modalUnits,
              }
            : level
        )
      );

      // 清理推荐列表中不在当前层级单元列表中的单元
      setRecommendedUnits((prev) =>
        prev.filter((item) => {
          if (item.levelId === editingLevelId) {
            return modalUnits.some((u) => u.id === item.unit.id);
          }
          return true;
        })
      );

      // 清理回收站中不在当前层级单元列表中的单元
      setTrashedUnits((prev) =>
        prev.filter((item) => {
          if (item.levelId === editingLevelId) {
            return modalUnits.some((u) => u.id === item.unit.id);
          }
          return true;
        })
      );
      setLevelName("");
      setLevelNameError("");
      setIdentifierType("numeric");
      setModalUnits([]);
      setEditingLevelId(null);
      setModalVisible(false);
    } else {
      setLevelNameError("请输入层级名称");
    }
  };

  const handleAddUnitInModal = () => {
    const nextIndex = modalUnits.length;
    const isNumeric = identifierType === "numeric";
    const newUnit: Unit = {
      id: `${Date.now()}-${nextIndex}`,
      name: isNumeric
        ? `${nextIndex + 1}` // 数字标识：1, 2, 3...
        : String.fromCharCode(65 + nextIndex), // 英文标识：A, B, C...
      status: "normal",
      features: [],
    };
    setModalUnits((prev) => [...prev, newUnit]);
  };

  const handleDeleteUnitInModal = (unitId: string) => {
    setModalUnits((prev) => prev.filter((unit) => unit.id !== unitId));
  };

  const handleClearUnits = () => {
    setModalUnits([]);
  };

  const handleDeleteLevel = (levelId: string) => {
    setLevelToDelete(levelId);
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = () => {
    if (!levelToDelete || !id) return;

    // 删除层级
    setLevels((prev) => prev.filter((item) => item.id !== levelToDelete));

    // 删除推荐列表中关联的单元
    setRecommendedUnits((prev) =>
      prev.filter((item) => item.levelId !== levelToDelete)
    );

    // 删除回收站中关联的单元
    setTrashedUnits((prev) =>
      prev.filter((item) => item.levelId !== levelToDelete)
    );

    // 删除收藏中关联的单元
    setFavoriteUnits((prev) =>
      prev.filter((item) => item.levelId !== levelToDelete)
    );

    setDeleteConfirmVisible(false);
    setLevelToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmVisible(false);
    setLevelToDelete(null);
  };

  const handleUnitDoublePress = (
    unit: Unit,
    levelName?: string,
    levelId?: string
  ) => {
    setEditingUnitId(unit.id);
    setEditingUnitName(unit.name);
    setUnitNameError("");
    // 如果提供了层级信息（从推荐页面调用），直接使用
    if (levelName && levelId) {
      setCurrentUnitForFavorite({
        unit,
        levelName,
        levelId,
      });
    } else {
      // 否则从层级列表中查找
      const level = levels.find((l) => l.units.some((u) => u.id === unit.id));
      if (level) {
        setCurrentUnitForFavorite({
          unit,
          levelName: level.name,
          levelId: level.id,
        });
      } else {
        // 如果找不到层级，尝试从推荐列表中查找
        const recommendedItem = recommendedUnits.find(
          (item) => item.unit.id === unit.id
        );
        if (recommendedItem) {
          setCurrentUnitForFavorite({
            unit,
            levelName: recommendedItem.levelName,
            levelId: recommendedItem.levelId,
          });
        }
      }
    }
  };

  const handleCancelUnitEdit = () => {
    setEditingUnitId(null);
    setCurrentUnitForFavorite(null);
    setFavoriteReason("");
    setEditingUnitName("");
    setUnitNameError("");
  };

  // 验证单元名称是否重复
  const validateUnitName = (unitName: string, unitId: string): boolean => {
    if (!unitName.trim()) {
      setUnitNameError("单元名称不能为空");
      return false;
    }

    if (!currentUnitForFavorite) {
      return true;
    }

    const level = levels.find((l) => l.id === currentUnitForFavorite.levelId);
    if (!level) {
      return true;
    }

    // 检查同一层次中是否有其他单元使用相同名称（排除当前编辑的单元）
    const duplicateUnit = level.units.find(
      (u) => u.id !== unitId && u.name.trim() === unitName.trim()
    );

    if (duplicateUnit) {
      setUnitNameError("该名称已被使用，请使用其他名称");
      return false;
    }

    setUnitNameError("");
    return true;
  };

  // 保存单元编辑（统一保存名称和特性）
  const handleSaveUnitEdit = () => {
    if (!editingUnitId || !editingUnitName.trim()) {
      Alert.alert("错误", "请输入单元名称");
      return;
    }

    if (!validateUnitName(editingUnitName.trim(), editingUnitId)) {
      return;
    }

    // 更新单元名称
    const level = levels.find((l) =>
      l.units.some((u) => u.id === editingUnitId)
    );
    if (level) {
      setLevels((prev) =>
        prev.map((l) =>
          l.id === level.id
            ? {
                ...l,
                units: l.units.map((u) =>
                  u.id === editingUnitId
                    ? { ...u, name: editingUnitName.trim() }
                    : u
                ),
              }
            : l
        )
      );
    }

    // 同时更新推荐、回收站、收藏中的单元名称
    setRecommendedUnits((prev) =>
      prev.map((item) =>
        item.unit.id === editingUnitId
          ? {
              ...item,
              unit: { ...item.unit, name: editingUnitName.trim() },
            }
          : item
      )
    );

    setTrashedUnits((prev) =>
      prev.map((item) =>
        item.unit.id === editingUnitId
          ? {
              ...item,
              unit: { ...item.unit, name: editingUnitName.trim() },
            }
          : item
      )
    );

    setFavoriteUnits((prev) =>
      prev.map((item) =>
        item.unit.id === editingUnitId
          ? {
              ...item,
              unit: { ...item.unit, name: editingUnitName.trim() },
            }
          : item
      )
    );

    // 关闭Modal
    setEditingUnitId(null);
    setCurrentUnitForFavorite(null);
    setEditingUnitName("");
    setUnitNameError("");
  };

  // 重置集合：将推荐和回收站的所有单元归位到对应的层级
  const handleResetCollection = useCallback(() => {
    // 先检查是否有数据需要重置
    const recommendedLength = recommendedUnitsRef.current.length;
    const trashedLength = trashedUnitsRef.current.length;

    if (recommendedLength === 0 && trashedLength === 0) {
      // 关闭确认框
      setResetConfirmVisible(false);
      // 显示提示信息
      setTimeout(() => {
        Alert.alert(
          "提示",
          "推荐和回收站都是空的，无需重置",
          [{ text: "确定" }],
          { cancelable: true }
        );
      }, 100);
      return;
    }

    // 使用函数式更新获取最新状态
    setRecommendedUnits((currentRecommended) => {
      setTrashedUnits((currentTrashed) => {
        setLevels((currentLevels) => {
          const updatedLevels = [...currentLevels];

          // 将推荐列表中的单元归位
          currentRecommended.forEach((item) => {
            const levelIndex = updatedLevels.findIndex(
              (l) => l.id === item.levelId
            );
            if (levelIndex !== -1) {
              const level = updatedLevels[levelIndex];
              // 检查单元是否已经在层级中
              const unitExists = level.units.some((u) => u.id === item.unit.id);
              if (!unitExists) {
                updatedLevels[levelIndex] = {
                  ...level,
                  units: [...level.units, item.unit],
                };
              }
            }
          });

          // 将回收站中的单元归位
          currentTrashed.forEach((item) => {
            const levelIndex = updatedLevels.findIndex(
              (l) => l.id === item.levelId
            );
            if (levelIndex !== -1) {
              const level = updatedLevels[levelIndex];
              // 检查单元是否已经在层级中
              const unitExists = level.units.some((u) => u.id === item.unit.id);
              if (!unitExists) {
                updatedLevels[levelIndex] = {
                  ...level,
                  units: [...level.units, item.unit],
                };
              }
            }
          });

          return updatedLevels;
        });

        // 清空回收站
        return [];
      });

      // 清空推荐列表
      return [];
    });
  }, []);

  const getUnitFeatureValue = (
    unitId: string,
    featureId: string
  ): number | boolean | undefined => {
    const unitFeature = unitFeatures.find(
      (uf) => uf.unitId === unitId && uf.featureId === featureId
    );
    // 如果特性是数值类型且没有值，默认返回0
    const feature = features.find((f) => f.id === featureId);
    if (feature?.type === "numeric" && unitFeature === undefined) {
      return 0;
    }
    return unitFeature?.value;
  };

  const handleUnitFeatureChange = (
    featureId: string,
    value: number | boolean
  ) => {
    if (!editingUnitId) return;

    setUnitFeatures((prev) => {
      const existing = prev.find(
        (uf) => uf.unitId === editingUnitId && uf.featureId === featureId
      );
      if (existing) {
        return prev.map((uf) =>
          uf.unitId === editingUnitId && uf.featureId === featureId
            ? { ...uf, value }
            : uf
        );
      } else {
        return [
          ...prev,
          {
            unitId: editingUnitId,
            featureId,
            value,
          },
        ];
      }
    });
  };

  // 判断单元是否在推荐列表中
  const isUnitInRecommended = (unitId: string) => {
    return recommendedUnits.some((item) => item.unit.id === unitId);
  };

  // 判断单元是否在回收站中
  const isUnitInTrash = (unitId: string) => {
    return trashedUnits.some((item) => item.unit.id === unitId);
  };

  // 判断单元是否已收藏
  const isUnitFavorited = (unitId: string) => {
    return favoriteUnits.some((item) => item.unit.id === unitId);
  };

  // 处理收藏单元
  const handleFavoriteUnit = (
    unit: Unit,
    levelName: string,
    levelId: string
  ) => {
    // 检查是否已收藏
    if (isUnitFavorited(unit.id)) {
      // 如果已收藏，取消收藏
      setFavoriteUnits((prev) =>
        prev.filter((item) => item.unit.id !== unit.id)
      );
      // 取消收藏后，确保收藏按钮仍然显示
      // currentUnitForFavorite 保持不变，这样按钮不会消失
    } else {
      // 如果未收藏，弹出输入框
      setCurrentUnitForFavorite({ unit, levelName, levelId });
      setFavoriteReason("");
      setFavoriteReasonModalVisible(true);
    }
  };

  // 确认收藏
  const handleConfirmFavorite = () => {
    if (!currentUnitForFavorite || !id) return;

    const newFavorite: FavoriteUnit = {
      unit: currentUnitForFavorite.unit,
      levelName: currentUnitForFavorite.levelName,
      levelId: currentUnitForFavorite.levelId,
      collectionId: id,
      reason: favoriteReason.trim() || "无",
      createdAt: Date.now(),
    };

    setFavoriteUnits((prev) => {
      // 检查是否已存在，避免重复
      const exists = prev.some((item) => item.unit.id === newFavorite.unit.id);
      if (exists) {
        return prev;
      }
      return [...prev, newFavorite];
    });

    setFavoriteReasonModalVisible(false);
    // 不重置 currentUnitForFavorite，保持收藏按钮显示
    setFavoriteReason("");
  };

  // 取消收藏输入
  const handleCancelFavorite = () => {
    setFavoriteReasonModalVisible(false);
    // 不重置 currentUnitForFavorite，保持收藏按钮显示
    setFavoriteReason("");
  };

  const [dragTranslationY, setDragTranslationY] = useState(0);

  // 处理层次拖拽开始
  const handleLevelDragStart = (index: number) => {
    setDraggedLevelIndex(index);
    setDragTranslationY(0);
  };

  // 处理层次拖拽更新
  const handleLevelDragUpdate = useCallback(
    (fromIndex: number, translationY: number) => {
      setDragTranslationY(translationY);
    },
    []
  );

  // 处理层次拖拽结束
  const handleLevelDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      setDraggedLevelIndex(null);
      setDragTranslationY(0);
      const maxIndex = levels.length - 1;
      const validToIndex = Math.max(0, Math.min(toIndex, maxIndex));

      if (fromIndex !== validToIndex && id) {
        setLevels((prev) => {
          const newLevels = [...prev];
          const [movedLevel] = newLevels.splice(fromIndex, 1);
          newLevels.splice(validToIndex, 0, movedLevel);

          // 更新dataManager
          const collectionIndex = dataManager
            .getCollections()
            .findIndex((c) => c.id === id);
          if (collectionIndex !== -1) {
            const collection = dataManager.getCollection(collectionIndex);
            if (collection) {
              dataManager.updateCollection(collectionIndex, {
                ...collection,
                levels: newLevels,
              });
              // 异步保存
              updateData();
            }
          }

          return newLevels;
        });
      }
    },
    [levels, id, dataManager, updateData]
  );

  // 退出排序模式
  const handleExitSortingMode = () => {
    setIsSortingMode(false);
    setDraggedLevelIndex(null);
  };

  // Stack.Screen 必须在组件顶层，确保始终渲染
  // 使用 key 确保每次渲染时都更新配置
  return (
    <>
      <Stack.Screen
        key={`collection-${id}-${collection?.name || name || "detail"}`}
        options={{
          title: collection?.name || name || id || "集合详情",
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
          headerRight: () => {
            return (
              <View style={styles.headerButtons}>
                {activeTab === "level" && (
                  <Pressable
                    style={[
                      styles.headerButton,
                      isSortingMode && styles.headerButtonActive,
                    ]}
                    onPress={() => setIsSortingMode(!isSortingMode)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    android_ripple={{ color: "#007AFF20" }}
                  >
                    <MaterialIcons
                      name="sort"
                      size={24}
                      color={isSortingMode ? "#0051D5" : "#007AFF"}
                    />
                  </Pressable>
                )}
                <Pressable
                  style={[
                    styles.headerButton,
                    refreshButtonPressed && { opacity: 0.6 },
                  ]}
                  onPress={handleRefreshPress}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  android_ripple={{ color: "#007AFF20" }}
                >
                  <MaterialIcons
                    name="refresh"
                    size={24}
                    color={refreshButtonPressed ? "#0051D5" : "#007AFF"}
                  />
                </Pressable>
              </View>
            );
          },
        }}
      />
      {!collection || loading ? (
        <ThemedView style={styles.container}>
          <ThemedText style={styles.loadingText}>加载中...</ThemedText>
        </ThemedView>
      ) : (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Tab 切换 */}
          {!isSortingMode && (
            <View
              style={styles.tabContainerWrapper}
              onLayout={(e) => {
                setTabContainerHeight(e.nativeEvent.layout.height);
              }}
            >
              <View style={styles.tabContainer}>
                <Pressable
                  style={[
                    styles.tab,
                    activeTab === "level" && styles.tabActive,
                  ]}
                  onPress={() => {
                    setActiveTab("level");
                    setShowMoreTabs(false);
                    setIsSortingMode(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.tabText,
                      activeTab === "level" && styles.tabTextActive,
                    ]}
                  >
                    层级
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.tab,
                    activeTab === "recommend" && styles.tabActive,
                  ]}
                  onPress={() => {
                    setActiveTab("recommend");
                    setShowMoreTabs(false);
                    setIsSortingMode(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.tabText,
                      activeTab === "recommend" && styles.tabTextActive,
                    ]}
                  >
                    推荐
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.moreTab}
                  onPress={() => setShowMoreTabs(!showMoreTabs)}
                >
                  <MaterialIcons
                    name="more-vert"
                    size={20}
                    color={showMoreTabs ? "#007AFF" : "#666666"}
                  />
                </Pressable>
              </View>

              {/* 下拉的 Tab 面板 */}
              {showMoreTabs && !isSortingMode && (
                <>
                  <Pressable
                    style={styles.dropdownOverlay}
                    onPress={() => setShowMoreTabs(false)}
                  />
                  <View
                    style={[
                      styles.dropdownTabsContainer,
                      { top: tabContainerHeight },
                    ]}
                  >
                    <Pressable
                      style={styles.dropdownTab}
                      onPress={() => {
                        setShowMoreTabs(false);
                        router.push({
                          pathname: `/collection/${id}/favorite` as any,
                          params: { collectionName: collection.name },
                        });
                      }}
                    >
                      <ThemedText style={styles.dropdownTabText}>
                        收藏
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.dropdownTab}
                      onPress={() => {
                        setShowMoreTabs(false);
                        router.push({
                          pathname: `/collection/${id}/trash` as any,
                          params: { collectionName: collection.name },
                        });
                      }}
                    >
                      <ThemedText style={styles.dropdownTabText}>
                        回收站
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
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
            {activeTab === "level" ? (
              <>
                {isSortingMode ? (
                  <>
                    {levels.length === 0 ? (
                      <ThemedView style={styles.emptyState}>
                        <ThemedText style={styles.emptyStateText}>
                          暂无层级
                        </ThemedText>
                      </ThemedView>
                    ) : (
                      <>
                        {levels.map((level, index) => (
                          <DraggableLevel
                            key={level.id}
                            level={level}
                            index={index}
                            onDragStart={handleLevelDragStart}
                            onDragEnd={handleLevelDragEnd}
                            onDragUpdate={handleLevelDragUpdate}
                            draggedIndex={draggedLevelIndex}
                            dragTranslationY={dragTranslationY}
                            itemHeight={60}
                          />
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {levels.length === 0 ? (
                      <ThemedView style={styles.emptyState}>
                        <ThemedText style={styles.emptyStateText}>
                          暂无层级，点击下方按钮创建第一个层级
                        </ThemedText>
                      </ThemedView>
                    ) : (
                      levels.map((level) => (
                        <View key={level.id} style={styles.levelItem}>
                          <View style={styles.levelHeader}>
                            <View style={styles.levelTitleContainer}>
                              <ThemedText style={styles.levelName}>
                                {level.name}
                              </ThemedText>
                            </View>
                            <View style={styles.levelActions}>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.iconButton,
                                  pressed && styles.iconButtonPressed,
                                ]}
                                onPress={() => handleEditLevel(level)}
                              >
                                <MaterialIcons
                                  name="edit"
                                  size={20}
                                  color="#007AFF"
                                />
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.iconButton,
                                  pressed && styles.iconButtonPressed,
                                ]}
                                onPress={() => handleDeleteLevel(level.id)}
                              >
                                <MaterialIcons
                                  name="delete"
                                  size={20}
                                  color="#FF3B30"
                                />
                              </Pressable>
                            </View>
                          </View>
                          {level.units && level.units.length > 0 && (
                            <View style={styles.unitsContainer}>
                              {level.units
                                .filter(
                                  (unit) =>
                                    !isUnitInRecommended(unit.id) &&
                                    !isUnitInTrash(unit.id)
                                )
                                .map((unit) => (
                                  <DraggableUnit
                                    key={unit.id}
                                    unit={unit}
                                    levelId={level.id}
                                    levelName={level.name}
                                    onMoveToRecommend={() => {
                                      // 不删除单元，只添加到推荐列表
                                      setRecommendedUnits((prev) => {
                                        // 检查是否已存在，避免重复
                                        const exists = prev.some(
                                          (item) => item.unit.id === unit.id
                                        );
                                        if (exists) {
                                          return prev;
                                        }
                                        return [
                                          ...prev,
                                          {
                                            unit,
                                            levelName: level.name,
                                            levelId: level.id,
                                            collectionId: id || "",
                                          },
                                        ];
                                      });
                                    }}
                                    onMoveToTrash={() => {
                                      // 不删除单元，只添加到回收站
                                      setTrashedUnits((prev) => {
                                        // 检查是否已存在，避免重复
                                        const exists = prev.some(
                                          (item) => item.unit.id === unit.id
                                        );
                                        if (exists) {
                                          return prev;
                                        }
                                        return [
                                          ...prev,
                                          {
                                            unit,
                                            levelName: level.name,
                                            levelId: level.id,
                                            collectionId: id || "",
                                          },
                                        ];
                                      });
                                    }}
                                    onDoublePress={() => {
                                      handleUnitDoublePress(unit, level.name, level.id);
                                    }}
                                  />
                                ))}
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </>
                )}
              </>
            ) : activeTab === "recommend" ? (
              <>
                {recommendedUnits.length === 0 ? (
                  <ThemedView style={styles.emptyState}>
                    <ThemedText style={styles.emptyStateText}>
                      暂无推荐单元
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <View style={styles.recommendTrashContainer}>
                    {recommendedUnits.map((item, index) => {
                      const unitFeaturesForUnit = features.map((feature) => {
                        const value = getUnitFeatureValue(
                          item.unit.id,
                          feature.id
                        );
                        return { feature, value };
                      });
                      return (
                        <View
                          key={`${item.unit.id}-${index}`}
                          style={styles.unitRow}
                        >
                          <Pressable
                            style={({ pressed }) => [
                              styles.unitRowContent,
                              pressed && styles.unitRowPressed,
                            ]}
                            onPress={() =>
                              handleUnitDoublePress(
                                item.unit,
                                item.levelName,
                                item.levelId
                              )
                            }
                          >
                            <View style={styles.unitRowContent}>
                              <ThemedText style={styles.unitRowText}>
                                {item.levelName} + {item.unit.name}
                              </ThemedText>
                              {unitFeaturesForUnit.length > 0 && (
                                <View style={styles.unitFeaturesContainer}>
                                  {unitFeaturesForUnit.map(
                                    ({ feature, value }) => {
                                      if (feature.type === "numeric") {
                                        // 数值类型：如果值为0或undefined则不显示
                                        return value !== undefined &&
                                          value !== 0 ? (
                                          <ThemedText
                                            key={feature.id}
                                            style={styles.unitFeatureText}
                                          >
                                            {feature.name}：{value}
                                          </ThemedText>
                                        ) : null;
                                      } else {
                                        // 单选类型：只有为true时才显示
                                        return value === true ? (
                                          <ThemedText
                                            key={feature.id}
                                            style={styles.unitFeatureText}
                                          >
                                            {feature.name}
                                          </ThemedText>
                                        ) : null;
                                      }
                                    }
                                  )}
                                </View>
                              )}
                            </View>
                          </Pressable>
                          <Pressable
                            style={styles.deleteButton}
                            onPress={() => {
                              // 从推荐列表删除，添加到回收站
                              setRecommendedUnits((prev) =>
                                prev.filter((i) => i.unit.id !== item.unit.id)
                              );
                              setTrashedUnits((prev) => {
                                const exists = prev.some(
                                  (i) => i.unit.id === item.unit.id
                                );
                                if (exists) {
                                  return prev;
                                }
                                return [
                                  ...prev,
                                  {
                                    unit: item.unit,
                                    levelName: item.levelName,
                                    levelId: item.levelId,
                                    collectionId: id || "",
                                  },
                                ];
                              });
                            }}
                          >
                            <MaterialIcons
                              name="delete"
                              size={20}
                              color="#FF3B30"
                            />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            ) : null}
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

          {/* 创建按钮（仅在层级 tab 显示） */}
          {activeTab === "level" && !isSortingMode && (
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
                  setLevelName("");
                  setLevelNameError("");
                  setIdentifierType("numeric");
                  setModalUnits([]);
                  setEditingLevelId(null);
                  setModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.createButtonText}>
                  创建层级
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 创建层级 Modal */}
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
                {editingLevelId ? "编辑层级" : "创建新层级"}
              </ThemedText>

              <TextInput
                style={[
                  styles.textInput,
                  levelNameError && styles.textInputError,
                ]}
                placeholder="请输入层级名称"
                value={levelName}
                onChangeText={(text) => {
                  setLevelName(text);
                  // 清除错误提示
                  if (levelNameError) {
                    setLevelNameError("");
                  }
                }}
                autoFocus={true}
              />
              {levelNameError ? (
                <ThemedText style={styles.errorText}>
                  {levelNameError}
                </ThemedText>
              ) : null}

              <View style={styles.identifierContainer}>
                <ThemedText style={styles.identifierLabel}>
                  标识类型：
                </ThemedText>
                <View style={styles.radioGroup}>
                  <Pressable
                    style={[
                      styles.radioOption,
                      identifierType === "numeric" && styles.radioOptionActive,
                    ]}
                    onPress={() => setIdentifierType("numeric")}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        identifierType === "numeric" &&
                          styles.radioCircleActive,
                      ]}
                    >
                      {identifierType === "numeric" && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.radioLabel,
                        identifierType === "numeric" && styles.radioLabelActive,
                      ]}
                    >
                      数字
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.radioOption,
                      identifierType === "alpha" && styles.radioOptionActive,
                    ]}
                    onPress={() => setIdentifierType("alpha")}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        identifierType === "alpha" && styles.radioCircleActive,
                      ]}
                    >
                      {identifierType === "alpha" && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.radioLabel,
                        identifierType === "alpha" && styles.radioLabelActive,
                      ]}
                    >
                      英文
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* 单元管理区域 */}
              <View style={styles.modalUnitsContainer}>
                <View style={styles.modalUnitsHeader}>
                  <ThemedText style={styles.modalUnitsTitle}>单元</ThemedText>
                  <View style={styles.modalUnitsActions}>
                    {modalUnits.length > 0 && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.modalClearButton,
                          pressed && styles.modalClearButtonPressed,
                        ]}
                        onPress={handleClearUnits}
                      >
                        <ThemedText style={styles.modalClearButtonText}>
                          清空
                        </ThemedText>
                      </Pressable>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalAddUnitButton,
                        pressed && styles.modalAddUnitButtonPressed,
                      ]}
                      onPress={handleAddUnitInModal}
                    >
                      <MaterialIcons name="add" size={18} color="#007AFF" />
                      <ThemedText style={styles.modalAddUnitButtonText}>
                        添加
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
                {modalUnits.length > 0 ? (
                  <View style={styles.modalUnitsList}>
                    {modalUnits.map((unit) => (
                      <View key={unit.id} style={styles.modalUnitItem}>
                        <ThemedText style={styles.modalUnitName}>
                          {unit.name}
                        </ThemedText>
                        <Pressable
                          style={({ pressed }) => [
                            styles.modalUnitDeleteButton,
                            pressed && styles.modalUnitDeleteButtonPressed,
                          ]}
                          onPress={() => handleDeleteUnitInModal(unit.id)}
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color="#FF3B30"
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.modalUnitsEmpty}>
                    暂无单元，点击添加按钮添加单元
                  </ThemedText>
                )}
              </View>
            </ScrollView>

            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setLevelName("");
                  setLevelNameError("");
                  setIdentifierType("numeric");
                  setModalUnits([]);
                  setEditingLevelId(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={editingLevelId ? handleUpdateLevel : handleCreateLevel}
              >
                <ThemedText style={styles.confirmButtonText}>
                  {editingLevelId ? "保存" : "创建"}
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
              确定要删除这个层级吗？此操作不可恢复。
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

      {/* 重置确认 Modal */}
      {resetConfirmVisible && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={resetConfirmVisible}
          onRequestClose={() => {
            setResetConfirmVisible(false);
          }}
          statusBarTranslucent={true}
          presentationStyle="overFullScreen"
        >
          <Pressable
            style={{ flex: 1, zIndex: 9999, elevation: 9999 }}
            onPress={() => {
              setResetConfirmVisible(false);
            }}
          >
            <ThemedView
              style={[
                styles.modalOverlay,
                {
                  zIndex: 9999,
                  elevation: 9999,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                }}
              >
                <ThemedView
                  style={[
                    styles.deleteModalContent,
                    {
                      zIndex: 10000,
                      elevation: 10000,
                    },
                  ]}
                  onStartShouldSetResponder={() => true}
                >
                  <ThemedText type="subtitle" style={styles.deleteModalTitle}>
                    确认重置
                  </ThemedText>
                  <ThemedText style={styles.deleteModalMessage}>
                    确定要重置集合吗？推荐和回收站的所有单元将归位到对应的层级。
                  </ThemedText>

                  <ThemedView style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        setResetConfirmVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.cancelButtonText}>
                        取消
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.deleteConfirmButton]}
                      onPress={() => {
                        try {
                          handleResetCollection();
                          setResetConfirmVisible(false);
                        } catch (error) {
                          console.error("重置集合失败:", error);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.deleteConfirmButtonText}>
                        确认
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>
      )}

      {/* 单元特性编辑 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editingUnitId !== null}
        onRequestClose={handleCancelUnitEdit}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <ThemedText type="subtitle" style={styles.modalTitle}>
                编辑单元
              </ThemedText>

              {/* 单元名称编辑 */}
              <TextInput
                style={[
                  styles.textInput,
                  unitNameError && styles.unitNameInputError,
                ]}
                placeholder="请输入单元名称"
                value={editingUnitName}
                onChangeText={(text) => {
                  setEditingUnitName(text);
                  if (unitNameError) {
                    setUnitNameError("");
                  }
                }}
                onBlur={() => {
                  if (editingUnitId && editingUnitName.trim()) {
                    validateUnitName(editingUnitName.trim(), editingUnitId);
                  }
                }}
                autoFocus={true}
              />
              {unitNameError ? (
                <ThemedText style={styles.unitNameErrorText}>
                  {unitNameError}
                </ThemedText>
              ) : null}

              {features.length === 0 ? (
                <ThemedText style={styles.emptyStateText}>
                  暂无特性，请先创建特性
                </ThemedText>
              ) : (
                features.map((feature) => {
                  const currentValue = getUnitFeatureValue(
                    editingUnitId || "",
                    feature.id
                  );
                  return (
                    <View key={feature.id} style={styles.featureRow}>
                      <ThemedText style={styles.featureName}>
                        {feature.name}
                      </ThemedText>
                      {feature.type === "numeric" ? (
                        <View style={styles.featureValueContainer}>
                          <Pressable
                            style={[
                              styles.selectButton,
                              currentValue !== undefined &&
                                styles.selectButtonActive,
                            ]}
                            onPress={() => {
                              setCurrentFeatureForPicker(feature);
                              setNumericPickerVisible(true);
                            }}
                          >
                            <ThemedText
                              style={[
                                styles.selectButtonText,
                                currentValue === undefined &&
                                  styles.selectButtonTextPlaceholder,
                              ]}
                            >
                              {currentValue !== undefined
                                ? currentValue.toString()
                                : "0"}
                            </ThemedText>
                            <MaterialIcons
                              name="arrow-drop-down"
                              size={20}
                              color={
                                currentValue !== undefined
                                  ? "#007AFF"
                                  : "#999999"
                              }
                            />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.radioGroup}>
                          <Pressable
                            style={[
                              styles.radioOption,
                              currentValue === true && styles.radioOptionActive,
                            ]}
                            onPress={() =>
                              handleUnitFeatureChange(feature.id, true)
                            }
                          >
                            <View
                              style={[
                                styles.radioCircle,
                                currentValue === true &&
                                  styles.radioCircleActive,
                              ]}
                            >
                              {currentValue === true && (
                                <View style={styles.radioInner} />
                              )}
                            </View>
                            <ThemedText
                              style={[
                                styles.radioLabel,
                                currentValue === true &&
                                  styles.radioLabelActive,
                              ]}
                            >
                              是
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.radioOption,
                              currentValue === false &&
                                styles.radioOptionActive,
                            ]}
                            onPress={() =>
                              handleUnitFeatureChange(feature.id, false)
                            }
                          >
                            <View
                              style={[
                                styles.radioCircle,
                                currentValue === false &&
                                  styles.radioCircleActive,
                              ]}
                            >
                              {currentValue === false && (
                                <View style={styles.radioInner} />
                              )}
                            </View>
                            <ThemedText
                              style={[
                                styles.radioLabel,
                                currentValue === false &&
                                  styles.radioLabelActive,
                              ]}
                            >
                              否
                            </ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <ThemedView style={styles.unitEditButtonWrapper}>
              {editingUnitId && currentUnitForFavorite && (
                <Pressable
                  style={[
                    styles.favoriteButtonInModal,
                    isUnitFavorited(editingUnitId) &&
                      styles.favoriteButtonInModalActive,
                  ]}
                  onPress={() => {
                    handleFavoriteUnit(
                      currentUnitForFavorite.unit,
                      currentUnitForFavorite.levelName,
                      currentUnitForFavorite.levelId
                    );
                  }}
                >
                  <MaterialIcons
                    name={
                      isUnitFavorited(editingUnitId) ? "star" : "star-border"
                    }
                    size={20}
                    color={
                      isUnitFavorited(editingUnitId) ? "#FFA500" : "#666666"
                    }
                  />
                  <ThemedText
                    style={[
                      styles.favoriteButtonText,
                      isUnitFavorited(editingUnitId) &&
                        styles.favoriteButtonTextActive,
                    ]}
                  >
                    {isUnitFavorited(editingUnitId) ? "已收藏" : "收藏"}
                  </ThemedText>
                </Pressable>
              )}
              <ThemedView style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancelUnitEdit}
                >
                  <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.confirmButton]}
                  onPress={handleSaveUnitEdit}
                >
                  <ThemedText style={styles.confirmButtonText}>保存</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* 数值选择器下拉框 */}
      {numericPickerVisible && currentFeatureForPicker && editingUnitId && (
        <Modal
          transparent={true}
          visible={numericPickerVisible}
          onRequestClose={() => {
            setNumericPickerVisible(false);
            setCurrentFeatureForPicker(null);
          }}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => {
              setNumericPickerVisible(false);
              setCurrentFeatureForPicker(null);
            }}
          >
            <View style={styles.pickerDropdown}>
              <ScrollView
                style={styles.pickerDropdownScroll}
                contentContainerStyle={styles.pickerDropdownContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <View style={styles.pickerDropdownGrid}>
                  {[0, ...Array.from({ length: 30 }, (_, i) => i + 1)].map(
                    (num) => {
                      const currentValue = getUnitFeatureValue(
                        editingUnitId || "",
                        currentFeatureForPicker.id
                      );
                      // 如果当前值为undefined，默认显示为0
                      const displayValue =
                        currentValue === undefined ? 0 : currentValue;
                      const isSelected = displayValue === num;
                      return (
                        <Pressable
                          key={num}
                          style={[
                            styles.pickerDropdownItem,
                            isSelected && styles.pickerDropdownItemActive,
                          ]}
                          onPress={() => {
                            handleUnitFeatureChange(
                              currentFeatureForPicker.id,
                              num
                            );
                            setNumericPickerVisible(false);
                            setCurrentFeatureForPicker(null);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.pickerDropdownItemText,
                              isSelected && styles.pickerDropdownItemTextActive,
                            ]}
                          >
                            {num}
                          </ThemedText>
                          {isSelected && (
                            <MaterialIcons
                              name="check"
                              size={16}
                              color="#007AFF"
                            />
                          )}
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* 收藏原因输入框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={favoriteReasonModalVisible}
        onRequestClose={handleCancelFavorite}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.favoriteModalContent}>
            <ThemedText style={styles.modalTitle}>收藏原因</ThemedText>
            <TextInput
              style={[styles.textInput, { minHeight: 100, marginBottom: 24 }]}
              placeholder="请输入收藏原因..."
              placeholderTextColor="#999999"
              multiline
              value={favoriteReason}
              onChangeText={setFavoriteReason}
              autoFocus
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancelFavorite}
              >
                <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirmFavorite}
              >
                <ThemedText style={styles.confirmButtonText}>确认</ThemedText>
              </TouchableOpacity>
            </View>
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtonActive: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 16,
    color: "#999999",
    textAlign: "center",
    marginTop: 40,
  },
  tabContainerWrapper: {
    position: "relative",
    zIndex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#007AFF",
  },
  tabText: {
    fontSize: 16,
    color: "#666666",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  moreTab: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: -1000, // 覆盖整个屏幕
    backgroundColor: "transparent",
    zIndex: 998,
  },
  dropdownTabsContainer: {
    position: "absolute",
    right: 16,
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    minWidth: 120,
    zIndex: 999,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dropdownTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  dropdownTabText: {
    fontSize: 15,
    color: "#666666",
    fontWeight: "500",
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
  levelItem: {
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
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  levelTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    lineHeight: 24,
  },
  levelIdentifier: {
    fontSize: 14,
    color: "#666666",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  levelActions: {
    flexDirection: "row",
    gap: 8,
  },
  unitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  unitsTitle: {
    fontSize: 15,
    color: "#666666",
    fontWeight: "500",
  },
  addUnitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#E3F2FD",
  },
  addUnitButtonPressed: {
    opacity: 0.7,
    backgroundColor: "#BBDEFB",
  },
  addUnitButtonText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  unitsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 8,
  },
  unitItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minHeight: 44,
    minWidth: 60,
  },
  unitEditButtonWrapper: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  favoriteButtonInModal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    width: "100%",
    marginBottom: 8,
  },
  favoriteButtonInModalActive: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFA500",
  },
  favoriteButtonText: {
    fontSize: 16,
    color: "#666666",
    fontWeight: "500",
  },
  favoriteButtonTextActive: {
    color: "#FFA500",
  },
  unitName: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
  recommendTrashContainer: {
    paddingVertical: 8,
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
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  unitRowText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
  unitDeleteButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFE5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  unitDeleteButtonPressed: {
    opacity: 0.6,
    backgroundColor: "#FFCCCC",
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
  modalUnitsContainer: {
    marginBottom: 24,
  },
  modalUnitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalUnitsTitle: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
  modalUnitsActions: {
    flexDirection: "row",
    gap: 8,
  },
  modalAddUnitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#E3F2FD",
  },
  modalAddUnitButtonPressed: {
    opacity: 0.7,
    backgroundColor: "#BBDEFB",
  },
  modalAddUnitButtonText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  modalClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FFE5E5",
  },
  modalClearButtonPressed: {
    opacity: 0.7,
    backgroundColor: "#FFCCCC",
  },
  modalClearButtonText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "500",
  },
  modalUnitsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    maxHeight: 200,
  },
  modalUnitItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  modalUnitName: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "500",
  },
  modalUnitDeleteButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFE5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalUnitDeleteButtonPressed: {
    opacity: 0.6,
    backgroundColor: "#FFCCCC",
  },
  modalUnitsEmpty: {
    fontSize: 14,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 20,
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
  favoriteModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    padding: 24,
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
    paddingBottom: 100,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 24,
    color: "#000000",
    fontSize: 20,
    fontWeight: "600",
  },
  modalSubtitle: {
    marginTop: 24,
    marginBottom: 16,
    color: "#000000",
    fontSize: 18,
    fontWeight: "600",
  },
  unitNameInputError: {
    borderColor: "#FF3B30",
  },
  unitNameErrorText: {
    fontSize: 14,
    color: "#FF3B30",
    marginTop: -20,
    marginBottom: 4,
  },
  sortingHint: {
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  sortingHintText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  sortableLevelItem: {
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
  sortableLevelName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    lineHeight: 24,
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
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    minWidth: 120,
  },
  dropdownButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
    marginRight: 8,
  },
  dropdownButtonTextPlaceholder: {
    color: "#999999",
  },
  unitRowPressed: {
    opacity: 0.7,
  },
  unitFeaturesContainer: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  unitFeatureText: {
    fontSize: 14,
    color: "#666666",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unitRowContent: {
    flex: 1,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    minWidth: 120,
    flex: 1,
  },
  selectButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  selectButtonText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
    marginRight: 8,
  },
  selectButtonTextPlaceholder: {
    color: "#999999",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerDropdown: {
    width: "100%",
    maxWidth: 400,
    maxHeight: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pickerDropdownScroll: {
    maxHeight: 400,
  },
  pickerDropdownContent: {
    padding: 12,
  },
  pickerDropdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerDropdownItem: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "transparent",
  },
  pickerDropdownItemActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#007AFF",
  },
  pickerDropdownItemText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
  pickerDropdownItemTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  featureRow: {
    marginBottom: 16,
  },
  featureName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 8,
  },
  featureValueContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
