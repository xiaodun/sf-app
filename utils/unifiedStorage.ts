import AsyncStorage from "@react-native-async-storage/async-storage";

import { DataMigration } from "@/utils/dataMigration";

import type { DataStructure } from "@/types/dataStructure";
import type {
  FavoriteUnit,
  Collection as OldCollection,
  Feature as OldFeature,
  Level as OldLevel,
  RecommendedUnit,
  TrashedUnit,
  UnitFeature,
} from "./storage";

const UNIFIED_DATA_KEY = "@sf_app:unified_data";
const MIGRATION_FLAG_KEY = "@sf_app:migration_completed";

/**
 * 统一存储管理器
 * @description 管理统一数据结构的存储和迁移
 */
class UnifiedStorage {
  /**
   * 检查是否需要迁移
   */
  static async needsMigration(): Promise<boolean> {
    try {
      const migrationFlag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      if (migrationFlag === "true") {
        return false; // 已经迁移过
      }

      // 检查是否存在旧数据
      const oldCollectionsKey = "@sf_app:collections";
      const oldCollections = await AsyncStorage.getItem(oldCollectionsKey);
      return oldCollections != null;
    } catch (error) {
      console.error("检查迁移状态失败:", error);
      return false;
    }
  }

  /**
   * 执行数据迁移
   */
  static async migrate(): Promise<DataStructure> {
    try {
      // 加载旧数据
      const [
        oldCollectionsJson,
        oldLevelsJson,
        oldFeaturesJson,
        oldUnitFeaturesJson,
        oldRecommendedUnitsJson,
        oldTrashedUnitsJson,
        oldFavoriteUnitsJson,
      ] = await Promise.all([
        AsyncStorage.getItem("@sf_app:collections"),
        AsyncStorage.getItem("@sf_app:levels"),
        AsyncStorage.getItem("@sf_app:features"),
        AsyncStorage.getItem("@sf_app:unit_features"),
        AsyncStorage.getItem("@sf_app:recommended_units"),
        AsyncStorage.getItem("@sf_app:trashed_units"),
        AsyncStorage.getItem("@sf_app:favorite_units"),
      ]);

      const oldCollections: OldCollection[] = oldCollectionsJson
        ? JSON.parse(oldCollectionsJson)
        : [];
      const oldLevels: OldLevel[] = oldLevelsJson
        ? JSON.parse(oldLevelsJson)
        : [];
      const oldFeatures: OldFeature[] = oldFeaturesJson
        ? JSON.parse(oldFeaturesJson)
        : [];
      const oldUnitFeatures: UnitFeature[] = oldUnitFeaturesJson
        ? JSON.parse(oldUnitFeaturesJson)
        : [];
      const oldRecommendedUnits: Record<string, RecommendedUnit[]> =
        oldRecommendedUnitsJson ? JSON.parse(oldRecommendedUnitsJson) : {};
      const oldTrashedUnits: Record<string, TrashedUnit[]> = oldTrashedUnitsJson
        ? JSON.parse(oldTrashedUnitsJson)
        : {};
      const oldFavoriteUnits: Record<string, FavoriteUnit[]> =
        oldFavoriteUnitsJson ? JSON.parse(oldFavoriteUnitsJson) : {};

      // 执行迁移
      const newData = DataMigration.migrateToUnifiedStructure(
        oldCollections,
        oldLevels,
        oldFeatures,
        oldUnitFeatures,
        oldRecommendedUnits,
        oldTrashedUnits,
        oldFavoriteUnits
      );

      // 保存新数据
      await AsyncStorage.setItem(UNIFIED_DATA_KEY, JSON.stringify(newData));

      // 标记迁移完成
      await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");

      return newData;
    } catch (error) {
      console.error("数据迁移失败:", error);
      // 返回空数据结构
      return {
        collections: [],
        features: {},
      };
    }
  }

  /**
   * 加载统一数据
   */
  static async loadUnifiedData(): Promise<DataStructure> {
    try {
      // 检查是否需要迁移
      const needsMigration = await this.needsMigration();
      if (needsMigration) {
        console.log("检测到旧数据，开始迁移...");
        return await this.migrate();
      }

      // 加载新数据
      const jsonValue = await AsyncStorage.getItem(UNIFIED_DATA_KEY);
      if (jsonValue != null) {
        const parsedData = JSON.parse(jsonValue) as DataStructure;
        // 验证数据结构
        if (
          parsedData &&
          Array.isArray(parsedData.collections) &&
          typeof parsedData.features === "object" &&
          parsedData.features !== null
        ) {
          return parsedData;
        }
      }

      // 返回默认数据结构
      return {
        collections: [],
        features: {},
      };
    } catch (error) {
      console.error("加载统一数据失败:", error);
      return {
        collections: [],
        features: {},
      };
    }
  }

  /**
   * 保存统一数据
   */
  static async saveUnifiedData(data: DataStructure): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(UNIFIED_DATA_KEY, jsonValue);
    } catch (error) {
      console.error("保存统一数据失败:", error);
      throw error;
    }
  }
}

export default UnifiedStorage;
