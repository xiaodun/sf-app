import UnifiedDataManager from "@/utils/unifiedDataManager";

import type {
  FavoriteUnit,
  Collection as OldCollection,
  Feature as OldFeature,
  Level as OldLevel,
  RecommendedUnit,
  TrashedUnit,
} from "./storage";

/**
 * 数据适配器
 * @description 将新数据结构适配为旧数据结构的访问方式，保持现有页面代码不变
 */
export class DataAdapter {
  private dataManager: UnifiedDataManager;

  constructor(dataManager: UnifiedDataManager) {
    this.dataManager = dataManager;
  }

  /**
   * 获取集合列表（适配旧接口）
   */
  getCollections(): OldCollection[] {
    const data = this.dataManager.getData();
    return data.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt,
    }));
  }

  /**
   * 根据集合ID获取层次列表（适配旧接口）
   */
  getLevelsByCollectionId(collectionId: string): OldLevel[] {
    const data = this.dataManager.getData();
    const collection = data.collections.find((c) => c.id === collectionId);
    if (!collection) return [];

    return collection.levels.map((level) => ({
      id: level.id,
      collectionId: collectionId,
      name: level.name,
      identifier: level.identifier,
      units: level.units.map((unit) => ({
        id: unit.id,
        name: unit.name,
      })),
      createdAt: level.createdAt,
    }));
  }

  /**
   * 根据集合ID获取特性列表（适配旧接口）
   */
  getFeaturesByCollectionId(collectionId: string): OldFeature[] {
    // 新结构中特性是全局的，collectionId 参数被忽略
    const data = this.dataManager.getData();
    return Object.values(data.features).map((feature) => ({
      id: feature.id,
      collectionId: "global",
      name: feature.name,
      type: feature.type,
      createdAt: feature.createdAt,
    }));
  }

  /**
   * 获取推荐单元（适配旧接口）
   */
  getRecommendedUnits(collectionId: string): RecommendedUnit[] {
    const data = this.dataManager.getData();
    const collection = data.collections.find((c) => c.id === collectionId);
    if (!collection) return [];

    const recommendedUnits: RecommendedUnit[] = [];

    collection.levels.forEach((level) => {
      level.units
        .filter((unit) => unit.status === "recommended")
        .forEach((unit) => {
          recommendedUnits.push({
            unit: { id: unit.id, name: unit.name },
            levelName: level.name,
            levelId: level.id,
            collectionId: collectionId,
          });
        });
    });

    return recommendedUnits;
  }

  /**
   * 获取回收站单元（适配旧接口）
   */
  getTrashedUnits(collectionId: string): TrashedUnit[] {
    const data = this.dataManager.getData();
    const collection = data.collections.find((c) => c.id === collectionId);
    if (!collection) return [];

    const trashedUnits: TrashedUnit[] = [];

    collection.levels.forEach((level) => {
      level.units
        .filter((unit) => unit.status === "trash")
        .forEach((unit) => {
          trashedUnits.push({
            unit: { id: unit.id, name: unit.name },
            levelName: level.name,
            levelId: level.id,
            collectionId: collectionId,
          });
        });
    });

    return trashedUnits;
  }

  /**
   * 获取收藏单元（适配旧接口）
   */
  getFavoriteUnits(collectionId: string): FavoriteUnit[] {
    const data = this.dataManager.getData();
    const collection = data.collections.find((c) => c.id === collectionId);
    if (!collection) return [];

    const favoriteUnits: FavoriteUnit[] = [];

    collection.levels.forEach((level) => {
      level.units
        .filter((unit) => unit.status === "favorite")
        .forEach((unit) => {
          favoriteUnits.push({
            unit: { id: unit.id, name: unit.name },
            levelName: level.name,
            levelId: level.id,
            collectionId: collectionId,
            reason: unit.favoriteReason || "无",
            createdAt: unit.favoriteCreatedAt || Date.now(),
          });
        });
    });

    return favoriteUnits;
  }

  /**
   * 获取单元特性（适配旧接口）
   */
  getUnitFeatures(): Array<{
    unitId: string;
    featureId: string;
    value: number | boolean;
  }> {
    const data = this.dataManager.getData();
    const unitFeatures: Array<{
      unitId: string;
      featureId: string;
      value: number | boolean;
    }> = [];

    data.collections.forEach((collection) => {
      collection.levels.forEach((level) => {
        level.units.forEach((unit) => {
          unit.features.forEach((feature) => {
            unitFeatures.push({
              unitId: unit.id,
              featureId: feature.featureId,
              value: feature.value,
            });
          });
        });
      });
    });

    return unitFeatures;
  }
}
