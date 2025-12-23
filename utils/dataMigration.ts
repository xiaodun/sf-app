import type {
  Collection,
  DataStructure,
  Level,
  Unit,
} from "@/types/dataStructure";
import type {
  FavoriteUnit,
  Collection as OldCollection,
  Feature as OldFeature,
  Level as OldLevel,
  RecommendedUnit,
  TrashedUnit,
  UnitFeature,
} from "./storage";

/**
 * 数据迁移工具
 * @description 将旧的数据结构迁移到新的统一数据结构
 */
export class DataMigration {
  /**
   * 从旧数据结构迁移到新数据结构
   */
  static migrateToUnifiedStructure(
    oldCollections: OldCollection[],
    oldLevels: OldLevel[],
    oldFeatures: OldFeature[],
    oldUnitFeatures: UnitFeature[],
    oldRecommendedUnits: Record<string, RecommendedUnit[]>,
    oldTrashedUnits: Record<string, TrashedUnit[]>,
    oldFavoriteUnits: Record<string, FavoriteUnit[]>
  ): DataStructure {
    const newData: DataStructure = {
      collections: [],
      features: {},
    };

    // 迁移特性
    oldFeatures.forEach((oldFeature) => {
      newData.features[oldFeature.id] = {
        id: oldFeature.id,
        name: oldFeature.name,
        type: oldFeature.type,
        createdAt: oldFeature.createdAt,
      };
    });

    // 迁移集合和层次
    oldCollections.forEach((oldCollection) => {
      const collectionLevels: Level[] = [];

      // 获取该集合的所有层次
      const collectionOldLevels = oldLevels.filter(
        (level) => level.collectionId === oldCollection.id
      );

      collectionOldLevels.forEach((oldLevel) => {
        // 获取该层次的推荐、回收站、收藏单元
        const recommendedUnits =
          oldRecommendedUnits[oldCollection.id]?.filter(
            (ru) => ru.levelId === oldLevel.id
          ) || [];
        const trashedUnits =
          oldTrashedUnits[oldCollection.id]?.filter(
            (tu) => tu.levelId === oldLevel.id
          ) || [];
        const favoriteUnits =
          oldFavoriteUnits[oldCollection.id]?.filter(
            (fu) => fu.levelId === oldLevel.id
          ) || [];

        // 创建推荐单元ID集合
        const recommendedUnitIds = new Set(
          recommendedUnits.map((ru) => ru.unit.id)
        );
        const trashedUnitIds = new Set(trashedUnits.map((tu) => tu.unit.id));
        const favoriteUnitIds = new Set(favoriteUnits.map((fu) => fu.unit.id));

        // 创建收藏单元映射（用于获取收藏原因和时间）
        const favoriteUnitMap = new Map(
          favoriteUnits.map((fu) => [fu.unit.id, fu])
        );

        // 转换单元
        const newUnits: Unit[] = oldLevel.units.map((oldUnit) => {
          // 确定单元状态
          let status: "normal" | "recommended" | "favorite" | "trash" =
            "normal";
          let favoriteReason: string | undefined;
          let favoriteCreatedAt: number | undefined;

          if (favoriteUnitIds.has(oldUnit.id)) {
            status = "favorite";
            const favoriteUnit = favoriteUnitMap.get(oldUnit.id);
            favoriteReason = favoriteUnit?.reason;
            favoriteCreatedAt = favoriteUnit?.createdAt;
          } else if (recommendedUnitIds.has(oldUnit.id)) {
            status = "recommended";
          } else if (trashedUnitIds.has(oldUnit.id)) {
            status = "trash";
          }

          // 获取单元的特性值
          const unitFeatures = oldUnitFeatures
            .filter((uf) => uf.unitId === oldUnit.id)
            .map((uf) => ({
              featureId: uf.featureId,
              value: uf.value,
            }));

          return {
            id: oldUnit.id,
            name: oldUnit.name,
            status,
            features: unitFeatures,
            ...(favoriteReason && { favoriteReason }),
            ...(favoriteCreatedAt && { favoriteCreatedAt }),
          };
        });

        // 创建新层次
        const newLevel: Level = {
          id: oldLevel.id,
          name: oldLevel.name,
          identifier: oldLevel.identifier,
          units: newUnits,
          createdAt: oldLevel.createdAt,
        };

        collectionLevels.push(newLevel);
      });

      // 创建集合对象并添加到集合数组
      const collection: Collection = {
        id: oldCollection.id,
        name: oldCollection.name,
        createdAt: oldCollection.createdAt,
        levels: collectionLevels,
      };
      newData.collections.push(collection);
    });

    return newData;
  }

  /**
   * 从新数据结构迁移回旧数据结构（用于兼容性，如果需要）
   */
  static migrateToOldStructure(newData: DataStructure): {
    collections: OldCollection[];
    levels: OldLevel[];
    features: OldFeature[];
    unitFeatures: UnitFeature[];
    recommendedUnits: Record<string, RecommendedUnit[]>;
    trashedUnits: Record<string, TrashedUnit[]>;
    favoriteUnits: Record<string, FavoriteUnit[]>;
  } {
    const oldCollections: OldCollection[] = [];
    const oldLevels: OldLevel[] = [];
    const oldFeatures: OldFeature[] = [];
    const oldUnitFeatures: UnitFeature[] = [];
    const oldRecommendedUnits: Record<string, RecommendedUnit[]> = {};
    const oldTrashedUnits: Record<string, TrashedUnit[]> = {};
    const oldFavoriteUnits: Record<string, FavoriteUnit[]> = {};

    // 迁移特性
    Object.values(newData.features).forEach((feature) => {
      oldFeatures.push({
        id: feature.id,
        collectionId: "global", // 旧结构中的全局特性
        name: feature.name,
        type: feature.type,
        createdAt: feature.createdAt,
      });
    });

    // 迁移集合和层次
    newData.collections.forEach((collection) => {
      // 创建旧集合
      oldCollections.push({
        id: collection.id,
        name: collection.name,
        createdAt: collection.createdAt,
      });

      // 初始化推荐、回收站、收藏数组
      oldRecommendedUnits[collection.id] = [];
      oldTrashedUnits[collection.id] = [];
      oldFavoriteUnits[collection.id] = [];

      // 迁移层次
      collection.levels.forEach((level) => {
        const oldLevel: OldLevel = {
          id: level.id,
          collectionId: collection.id,
          name: level.name,
          identifier: level.identifier,
          units: [],
          createdAt: level.createdAt,
        };

        // 迁移单元
        level.units.forEach((unit) => {
          // 添加到层次的单元列表（所有单元都在层次中）
          oldLevel.units.push({
            id: unit.id,
            name: unit.name,
          });

          // 根据状态添加到对应的列表
          if (unit.status === "recommended") {
            oldRecommendedUnits[collection.id].push({
              unit: { id: unit.id, name: unit.name },
              levelName: level.name,
              levelId: level.id,
              collectionId: collection.id,
            });
          } else if (unit.status === "trash") {
            oldTrashedUnits[collection.id].push({
              unit: { id: unit.id, name: unit.name },
              levelName: level.name,
              levelId: level.id,
              collectionId: collection.id,
            });
          } else if (unit.status === "favorite") {
            oldFavoriteUnits[collection.id].push({
              unit: { id: unit.id, name: unit.name },
              levelName: level.name,
              levelId: level.id,
              collectionId: collection.id,
              reason: unit.favoriteReason || "无",
              createdAt: unit.favoriteCreatedAt || Date.now(),
            });
          }

          // 迁移单元特性
          unit.features.forEach((unitFeature) => {
            oldUnitFeatures.push({
              unitId: unit.id,
              featureId: unitFeature.featureId,
              value: unitFeature.value,
            });
          });
        });

        oldLevels.push(oldLevel);
      });
    });

    return {
      collections: oldCollections,
      levels: oldLevels,
      features: oldFeatures,
      unitFeatures: oldUnitFeatures,
      recommendedUnits: oldRecommendedUnits,
      trashedUnits: oldTrashedUnits,
      favoriteUnits: oldFavoriteUnits,
    };
  }
}
